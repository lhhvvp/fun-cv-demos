const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication');

const apps = require('./apps.json');

const isDevelopment = !app.isPackaged || process.env.NODE_ENV === 'development';
const shouldOpenDevTools = isDevelopment && process.env.OPEN_DEVTOOLS === 'true';
const appWindows = new Map();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function getContentRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
}

function resolveFromRoot(...segments) {
  return path.join(getContentRoot(), ...segments);
}

function getAppDescriptor() {
  return apps.map((entry) => {
    const thumbnailAbsolute = resolveFromRoot(entry.thumbnail);
    const thumbnailPath = fs.existsSync(thumbnailAbsolute)
      ? pathToFileURL(thumbnailAbsolute).href
      : null;

    return {
      slug: entry.slug,
      title: entry.title,
      description: entry.description,
      thumbnailPath,
    };
  });
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Fun with Computer Vision',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#181b21' : '#f6f8fb',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  if (shouldOpenDevTools) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return mainWindow;
}

function ensureEntryExists(appMeta) {
  const entryCandidate = resolveFromRoot(appMeta.slug, appMeta.entry || 'index.html');
  if (!fs.existsSync(entryCandidate)) {
    throw new Error(`Missing entry file for "${appMeta.title}" at ${entryCandidate}`);
  }

  return entryCandidate;
}

function createOrFocusAppWindow(appMeta) {
  const existing = appWindows.get(appMeta.slug);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) {
      existing.restore();
    }
    existing.focus();
    return existing;
  }

  const targetFile = ensureEntryExists(appMeta);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: appMeta.title,
    backgroundColor: '#06080f',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(targetFile);

  win.on('closed', () => {
    appWindows.delete(appMeta.slug);
  });

  appWindows.set(appMeta.slug, win);
  return win;
}

app.on('second-instance', () => {
  const [firstWindow] = BrowserWindow.getAllWindows();
  if (firstWindow) {
    if (firstWindow.isMinimized()) firstWindow.restore();
    firstWindow.focus();
  }
});

app.whenReady().then(() => {
  createMainWindow();

  ipcMain.handle('get-apps', () => getAppDescriptor());

  ipcMain.handle('open-app', (_event, slug) => {
    const appMeta = apps.find((entry) => entry.slug === slug);
    if (!appMeta) {
      throw new Error(`Launcher could not find app with slug "${slug}"`);
    }
    createOrFocusAppWindow(appMeta);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
