import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { PDFManager, type PDFManagerConfig } from './services/PDFManager';

export interface ScanProgress {
  fileName: string;
  pageNumber: number;
  totalPages: number;
}

/**
 * Initialize scanner IPC handlers
 * Registers IPC handlers for PDF scanning operations
 */
export function initializeScannerHandlers(): void {
  // IPC Handler: Scan a single PDF file
  ipcMain.handle('scan-pdf-file', async (_event, filePath: string, config: PDFManagerConfig = {}) => {
    try {
      const pdfManager = new PDFManager(config);
      const fileBuffer = await fs.readFile(filePath);
      const file = new File([fileBuffer], path.basename(filePath), { type: 'application/pdf' });

      return await pdfManager.processFile(file);
    } catch (error) {
      return {
        fileName: path.basename(filePath),
        totalPages: 0,
        results: {},
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during scanning',
      };
    }
  });

  // IPC Handler: Scan multiple PDF files with progress tracking
  ipcMain.handle(
    'scan-pdf-batch',
    async (_event, filePaths: string[], config: PDFManagerConfig = {}) => {
      const results: Record<string, unknown> = {};
      const failedFiles: string[] = [];

      for (const filePath of filePaths) {
        try {
          const pdfManager = new PDFManager(config);
          const fileBuffer = await fs.readFile(filePath);
          const file = new File([fileBuffer], path.basename(filePath), { type: 'application/pdf' });

          const result = await pdfManager.processFile(file, (progressData) => {
            // Send progress updates to renderer
            _event.sender.send('scan-progress', {
              filePath,
              ...progressData,
            } as ScanProgress & { filePath: string });
          });

          results[path.basename(filePath)] = result;
        } catch (error) {
          failedFiles.push(path.basename(filePath));
          results[path.basename(filePath)] = {
            fileName: path.basename(filePath),
            totalPages: 0,
            results: {},
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during scanning',
          };
        }
      }

      return {
        allResults: results,
        failedFiles,
        successCount: filePaths.length - failedFiles.length,
        failureCount: failedFiles.length,
      };
    }
  );

  // IPC Handler: Scan directory for all PDF files
  ipcMain.handle('scan-directory', async (_event, dirPath: string, config: PDFManagerConfig = {}) => {
    try {
      const files = await fs.readdir(dirPath);
      const pdfFiles = files.filter((file) => file.toLowerCase().endsWith('.pdf'));

      const results: Record<string, unknown> = {};
      const failedFiles: string[] = [];

      for (const fileName of pdfFiles) {
        try {
          const filePath = path.join(dirPath, fileName);
          const pdfManager = new PDFManager(config);
          const fileBuffer = await fs.readFile(filePath);
          const file = new File([fileBuffer], fileName, { type: 'application/pdf' });

          const result = await pdfManager.processFile(file, (progressData) => {
            // Send progress updates to renderer
            _event.sender.send('scan-progress', {
              filePath,
              ...progressData,
            } as ScanProgress & { filePath: string });
          });

          results[fileName] = result;
        } catch (error) {
          failedFiles.push(fileName);
          results[fileName] = {
            fileName,
            totalPages: 0,
            results: {},
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during scanning',
          };
        }
      }

      return {
        scannedCount: pdfFiles.length - failedFiles.length,
        failedCount: failedFiles.length,
        failedFiles,
        results,
      };
    } catch (error) {
      throw new Error(`Failed to scan directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}
