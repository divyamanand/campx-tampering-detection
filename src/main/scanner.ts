import { ipcMain } from 'electron';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { PDFManager, type PDFManagerConfig } from './services/PDFManager';

export interface ScanProgress {
  fileName: string;
  pageNumber: number;
  totalPages: number;
}

export function initializeScannerHandlers(): void {

  ipcMain.handle(
    'scan-pdf-file',
    async (_event, filePath: string, config: PDFManagerConfig = {}) => {
      try {
        // console.log("Tried files scanning")
        const pdfManager = new PDFManager(config);
        const buffer = await readFile(filePath);

        const res = await pdfManager.processBuffer(
          buffer,
          path.basename(filePath)
        );
        console.log(res)
        return res
      } catch (error) {
        // console.error(error)
        return {
          fileName: path.basename(filePath),
          totalPages: 0,
          results: {},
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error during scanning',
        };
      }
    }
  );

  ipcMain.handle(
    'scan-pdf-batch',
    async (_event, filePaths: string[], config: PDFManagerConfig = {}) => {
      const results: Record<string, unknown> = {};
      const failedFiles: string[] = [];

      for (const filePath of filePaths) {
        const fileName = path.basename(filePath);

        try {
          const pdfManager = new PDFManager(config);
          const buffer = await readFile(filePath);

          const result = await pdfManager.processBuffer(
            buffer,
            fileName,
          );

          results[fileName] = result;
        } catch (error) {
          failedFiles.push(fileName);
          results[fileName] = {
            fileName,
            totalPages: 0,
            results: {},
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error during scanning',
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

  ipcMain.handle(
    'scan-directory',
    async (_event, dirPath: string, config: PDFManagerConfig = {}) => {
      const entries = await readdir(dirPath, { withFileTypes: true });

      const pdfFiles = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
        .map((e) => e.name);

      const results: Record<string, unknown> = {};
      const failedFiles: string[] = [];

      for (const fileName of pdfFiles) {
        const filePath = path.join(dirPath, fileName);

        try {
          const pdfManager = new PDFManager(config);
          const buffer = await readFile(filePath);

          const result = await pdfManager.processBuffer(
            buffer,
            fileName
          );

          results[fileName] = result;
        } catch (error) {
          failedFiles.push(fileName);
          results[fileName] = {
            fileName,
            totalPages: 0,
            results: {},
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error during scanning',
          };
        }
      }

      return {
        scannedCount: pdfFiles.length - failedFiles.length,
        failedCount: failedFiles.length,
        failedFiles,
        results,
      };
    }
  );
}
