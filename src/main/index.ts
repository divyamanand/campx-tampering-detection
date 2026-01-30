import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';

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
}

/**
 * Generate a timestamp-based log filename
 * Format: logs_YYYYMMDD_HHMMSS.json
 */
function generateLogFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `logs_${year}${month}${day}_${hours}${minutes}${seconds}.json`;
}

// IPC Handler: Select directory
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Processing Directory',
    buttonLabel: 'Select',
  });

  if (result.canceled) {
    throw new Error('Directory selection was cancelled');
  }

  return result.filePaths[0];
});

// IPC Handler: Create logs folder
ipcMain.handle('create-logs-folder', async (_event, dirPath: string) => {
  const logsDir = path.join(dirPath, 'logs');
  try {
    await fs.mkdir(logsDir, { recursive: true });
    return logsDir;
  } catch (error) {
    throw new Error(`Failed to create logs folder: ${(error as Error).message}`);
  }
});

// IPC Handler: Write log file
ipcMain.handle('write-log-file', async (_event, dirPath: string, data: unknown) => {
  const logsDir = path.join(dirPath, 'logs');
  const logFileName = generateLogFileName();
  const filePath = path.join(logsDir, logFileName);

  try {
    await fs.mkdir(logsDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return logFileName;
  } catch (error) {
    throw new Error(`Failed to write log file: ${(error as Error).message}`);
  }
});

// IPC Handler: Read log file
ipcMain.handle('read-log-file', async (_event, dirPath: string, logFileName: string) => {
  const filePath = path.join(dirPath, 'logs', logFileName);

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw new Error(`Failed to read log file: ${(error as Error).message}`);
  }
});

// IPC Handler: Verify logs and get pages requiring retry
ipcMain.handle('verify-logs', async (_event, dirPath: string, logFileName: string) => {
  const filePath = path.join(dirPath, 'logs', logFileName);

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const logs = JSON.parse(fileContent);

    const bestCounts: Record<string, { QRCode: number; Code128: number }> = {};
    const filesToRetry: Record<string, number[]> = {};

    // First pass: Find the maximum count for each page number
    Object.entries(logs).forEach(([_fileName, fileLog]: [string, unknown]) => {
      const fileLogData = fileLog as Record<string, { codes?: Array<{ QRCode?: boolean; Code128?: boolean }> }>;
      Object.entries(fileLogData).forEach(([pageNumber, pageData]) => {
        if (!bestCounts[pageNumber]) {
          bestCounts[pageNumber] = { QRCode: 0, Code128: 0 };
        }

        let qrCount = 0;
        let code128Count = 0;

        if (pageData.codes && Array.isArray(pageData.codes)) {
          pageData.codes.forEach((codeObj) => {
            if (codeObj.QRCode) qrCount++;
            if (codeObj.Code128) code128Count++;
          });
        }

        bestCounts[pageNumber].QRCode = Math.max(bestCounts[pageNumber].QRCode, qrCount);
        bestCounts[pageNumber].Code128 = Math.max(bestCounts[pageNumber].Code128, code128Count);
      });
    });

    // Second pass: Identify pages that need retry
    Object.entries(logs).forEach(([fileName, fileLog]: [string, unknown]) => {
      const fileLogData = fileLog as Record<string, { codes?: Array<{ QRCode?: boolean; Code128?: boolean }> }>;
      Object.entries(fileLogData).forEach(([pageNumber, pageData]) => {
        let qrCount = 0;
        let code128Count = 0;

        if (pageData.codes && Array.isArray(pageData.codes)) {
          pageData.codes.forEach((codeObj) => {
            if (codeObj.QRCode) qrCount++;
            if (codeObj.Code128) code128Count++;
          });
        }

        const needsRetry =
          qrCount < bestCounts[pageNumber].QRCode ||
          code128Count < bestCounts[pageNumber].Code128;

        if (needsRetry) {
          if (!filesToRetry[fileName]) {
            filesToRetry[fileName] = [];
          }
          filesToRetry[fileName].push(parseInt(pageNumber));
        }
      });
    });

    // Sort page numbers for each file
    Object.keys(filesToRetry).forEach((fileName) => {
      filesToRetry[fileName].sort((a, b) => a - b);
    });

    return {
      filesToRetry,
      bestCounts,
    };
  } catch (error) {
    throw new Error(`Failed to verify logs: ${(error as Error).message}`);
  }
});

app.whenReady().then(createWindow);

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
