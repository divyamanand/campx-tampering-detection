import { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { initializeScannerHandlers } from './scanner';
import { prepareZXingModule } from 'zxing-wasm/reader';
import { readFileSync } from 'node:fs';
import { getSettingsService, initializeSettings, type AppSettings } from './utils/SettingsService';
import { initializeRoutingWorkerPool } from './workers/RoutingWorkerPool';

// Main window reference for sending events from worker threads
let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let isQuitting = false;

function createTray(): void {
  // Create a simple colored icon for tray
  const trayIcon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAC0lEQVR4nGNgYAAAABAA+6+6r5EAAAAASUVORK5CYII='
  );

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Show window when clicking tray icon
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // Don't show until ready
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  // Show window when ready
  win.once('ready-to-show', () => {
    win.show();
  });

  // Handle close button: minimize to tray instead of closing
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  mainWindow = win;
  return;
}

prepareZXingModule({
  overrides: {
    wasmBinary: readFileSync("E:/Dev/campx/campx-tampering-detection/assets/wasm/zxing_reader.wasm")
      .buffer as ArrayBuffer,
  },
});

// IPC Handler: Select directory for scanning
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Directory to Scan',
    buttonLabel: 'Select',
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// IPC Handler: Select file for scanning
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    title: 'Select PDF File to Scan',
    buttonLabel: 'Select',
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// IPC Handlers: Settings management
ipcMain.handle('get-settings', async () => {
  const settingsService = getSettingsService();
  return settingsService.getSettings();
});

ipcMain.handle('update-settings', async (_event, settings: Partial<AppSettings>) => {
  const settingsService = getSettingsService();
  return settingsService.saveSettings(settings);
});

ipcMain.handle('update-setting', async (_event, key: keyof AppSettings, value: unknown) => {
  const settingsService = getSettingsService();
  return settingsService.updateSetting(key, value as any);
});

ipcMain.handle('reset-settings', async () => {
  const settingsService = getSettingsService();
  return settingsService.resetToDefaults();
});

app.whenReady().then(async () => {
  // Initialize settings on app startup
  await initializeSettings();

  // Initialize routing worker pool for file routing
  initializeRoutingWorkerPool();

  // Create window first so we can pass it to scanner handlers
  createWindow();

  // Create system tray
  createTray();

  // Initialize scanner handlers with mainWindow reference
  initializeScannerHandlers(mainWindow);
});

// Only quit when explicitly requested (not when closing window)
app.on('window-all-closed', () => {
  // Don't quit on window close - let minimize-to-tray handle it
  // User must use tray menu "Quit" or Alt+F4 with isQuitting flag
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    createTray();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
