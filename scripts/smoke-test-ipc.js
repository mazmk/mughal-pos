#!/usr/bin/env node
/**
 * Launches the real Electron app headlessly, waits for it to boot, then
 * invokes window.api.health.status() from inside the renderer via executeJavaScript.
 *
 * Prints PASS/FAIL. Requires Angular production bundle + compiled Electron.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const electronBin = require('electron');
const projectRoot = path.resolve(__dirname, '..');

// Inject a short runtime probe into main.js by loading via a wrapper that
// imports the real main then evaluates the health IPC against the webContents.
const probe = `
const { app, BrowserWindow, ipcMain } = require('electron');

// A throwaway data folder, so this test never touches a real shop.
app.setPath('userData', require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'mughal-smoke-ipc-')));
require('./dist-electron/electron/main/main.js');

app.whenReady().then(async () => {
  // Wait for the window to be visible, then run the probe.
  const waitForWindow = () => new Promise(resolve => {
    const check = () => {
      const w = BrowserWindow.getAllWindows()[0];
      if (w && !w.webContents.isLoading()) resolve(w);
      else setTimeout(check, 200);
    };
    check();
  });
  const win = await waitForWindow();

  try {
    const probeScript = \`(async () => {
      if (!window.api) return JSON.stringify({ ok: false, error: { code: 'NO_BRIDGE', message: 'window.api is undefined' } });
      const health = await window.api.health.status();
      const list = await window.api.products.list();
      const settings = await window.api.settings.list();
      return JSON.stringify({ health, list, settings });
    })()\`;
    const result = await win.webContents.executeJavaScript(probeScript);
    console.log('[probe] response:', result);
    const parsed = JSON.parse(result);
    if (!parsed.health.ok) throw new Error('health IPC error: ' + JSON.stringify(parsed.health));
    if (!parsed.list.ok) throw new Error('products.list IPC error: ' + JSON.stringify(parsed.list));
    if (!parsed.settings.ok) throw new Error('settings.list IPC error: ' + JSON.stringify(parsed.settings));
    if (!parsed.health.data.databaseInitialized) throw new Error('database not initialized');
    if (parsed.health.data.schemaVersion !== 3) throw new Error('unexpected schema version');
    if (!Array.isArray(parsed.list.data)) throw new Error('products.list did not return array');
    if (!Array.isArray(parsed.settings.data) || parsed.settings.data.length === 0) {
      throw new Error('settings.list did not return seeded rows');
    }
    console.log('[probe] PASS');
    app.exit(0);
  } catch (err) {
    console.error('[probe] FAIL', err);
    app.exit(1);
  }
});
`;

const probeFile = path.join(projectRoot, '.probe.main.js');
fs.writeFileSync(probeFile, probe);

// Scrub ELECTRON_RUN_AS_NODE from the env — if present (e.g. inherited from a
// VS Code / Cursor terminal that runs its own Electron bundle), it forces this
// Electron to boot as plain Node and require('electron') returns a string
// instead of the API object. The main process would then crash on app.on().
const cleanEnv = { ...process.env, NODE_ENV: 'production' };
delete cleanEnv.ELECTRON_RUN_AS_NODE;
delete cleanEnv.ELECTRON_NO_ATTACH_CONSOLE;

const child = spawn(electronBin, [probeFile], {
  cwd: projectRoot,
  env: cleanEnv,
  stdio: 'inherit',
});

const kill = setTimeout(() => {
  console.error('[probe] timeout — killing');
  child.kill('SIGKILL');
  process.exit(2);
}, 30000);

child.on('exit', (code) => {
  clearTimeout(kill);
  fs.unlinkSync(probeFile);
  process.exit(code ?? 0);
});
