#!/usr/bin/env node
/**
 * Launches Electron for `npm run electron:dev` with a clean environment.
 *
 * Why not `cross-env ELECTRON_RUN_AS_NODE= electron .`: that sets the variable
 * to an empty string instead of removing it. macOS Electron ignores an empty
 * value, but Windows Electron (getenv_s) treats any defined variable as set and
 * boots as plain Node — `require('electron').app` is then undefined and main.js
 * crashes on `app.on('ready')`. IDE terminals (VS Code, Cursor) also leak
 * ELECTRON_RUN_AS_NODE=1, so the variable has to be deleted, not blanked.
 *
 * Usage: node scripts/electron-dev.js [electron args…]   (defaults to ".")
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const electronBin = require('electron');
const projectRoot = path.resolve(__dirname, '..');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

const args = process.argv.slice(2);
const child = spawn(electronBin, args.length ? args : ['.'], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});

// concurrently -k sends SIGTERM on shutdown; forward it so Electron closes too.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
