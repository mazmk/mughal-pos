import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { getAppPaths } from './paths';
import { initializeDatabase, closeDatabase } from '../database/connection';
import { registerAllIpcHandlers } from '../ipc';

const isDev = process.env['NODE_ENV'] === 'development';
let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#101014',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, navUrl) => {
    const current = window.webContents.getURL();
    if (new URL(navUrl).origin !== new URL(current).origin) {
      event.preventDefault();
      shell.openExternal(navUrl);
    }
  });

  if (isDev) {
    window.loadURL('http://localhost:4200');
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexFile = join(__dirname, '../../../dist/mughal-pos/browser/index.html');
    window.loadFile(indexFile);
  }

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    mainWindow = null;
  });

  return window;
}

async function bootstrap(): Promise<void> {
  const paths = getAppPaths();
  console.log('[main] user data root:', paths.root);

  initializeDatabase(paths.databaseFile);
  registerAllIpcHandlers();

  mainWindow = createMainWindow();
}

app.on('ready', () => {
  void bootstrap();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.on('before-quit', () => {
  closeDatabase();
});

app.on('render-process-gone', (_event, _webContents, details) => {
  console.error('[main] renderer process gone:', details);
});

process.on('uncaughtException', (err) => {
  console.error('[main] uncaught:', err);
});
