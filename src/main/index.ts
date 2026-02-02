import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { initializeScannerHandlers } from './scanner';
import { prepareZXingModule } from 'zxing-wasm/reader';
import { readFileSync } from 'node:fs';
import { getSettingsService, initializeSettings, type AppSettings } from './utils/SettingsService';

// Main window reference for sending events from worker threads
let mainWindow: BrowserWindow | undefined;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

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

  // Create window first so we can pass it to scanner handlers
  createWindow();

  // Initialize scanner handlers with mainWindow reference
  initializeScannerHandlers(mainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
