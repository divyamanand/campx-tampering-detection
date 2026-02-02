import { ipcMain } from 'electron';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { PDFManager, type PDFManagerConfig } from './services/PDFManager';
import { LogService } from './services/LogService';
import { getSettingsService } from './utils/SettingsService';

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
        const settingsService = getSettingsService();
        const settings = settingsService.getSettings();

        // Use global settings for config if not explicitly provided
        const mergedConfig: PDFManagerConfig = {
          initialScale: config.initialScale ?? settings.initialScale,
          enableRotation: config.enableRotation ?? settings.enableRotation,
          rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
        };

        const pdfManager = new PDFManager(mergedConfig);
        const buffer = await readFile(filePath);

        const res = await pdfManager.processBuffer(
          buffer,
          path.basename(filePath)
        );
        console.log(res);

        // Log results using global settings directory
        if (settings.directory) {
          try {
            const logService = new LogService(settings.directory);
            await logService.logFileProcess(res);
          } catch (logError) {
            console.warn('Failed to log file process:', logError);
            // Don't fail the scan if logging fails
          }
        }

        return res;
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
      const settingsService = getSettingsService();
      const settings = settingsService.getSettings();

      // Use global settings for config if not explicitly provided
      const mergedConfig: PDFManagerConfig = {
        initialScale: config.initialScale ?? settings.initialScale,
        enableRotation: config.enableRotation ?? settings.enableRotation,
        rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
      };

      const results: Record<string, unknown> = {};
      const failedFiles: string[] = [];
      const logResults: Array<any> = [];

      for (const filePath of filePaths) {
        const fileName = path.basename(filePath);

        try {
          const pdfManager = new PDFManager(mergedConfig);
          const buffer = await readFile(filePath);

          const result = await pdfManager.processBuffer(
            buffer,
            fileName,
          );

          results[fileName] = result;
          logResults.push(result);
        } catch (error) {
          failedFiles.push(fileName);
          const errorResult = {
            fileName,
            totalPages: 0,
            results: {},
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error during scanning',
          };
          results[fileName] = errorResult;
          logResults.push(errorResult);
        }
      }

      // Log all results using global settings directory
      if (settings.directory && logResults.length > 0) {
        try {
          const logService = new LogService(settings.directory);
          await logService.logMultipleFiles(logResults);
        } catch (logError) {
          console.warn('Failed to log batch results:', logError);
          // Don't fail the scan if logging fails
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
      const settingsService = getSettingsService();
      const settings = settingsService.getSettings();

      console.log("Directory Scanning Started")

      // Use global settings for config if not explicitly provided
      const mergedConfig: PDFManagerConfig = {
        initialScale: config.initialScale ?? settings.initialScale,
        enableRotation: config.enableRotation ?? settings.enableRotation,
        rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
      };

      const entries = await readdir(dirPath, { withFileTypes: true });

      const pdfFiles = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
        .map((e) => e.name);

      console.log("All the files in directory", pdfFiles)

      const results: Record<string, unknown> = {};
      const failedFiles: string[] = [];
      const logResults: Array<any> = [];
      let count = 0

      for (const fileName of pdfFiles) {
        const filePath = path.join(dirPath, fileName);

        try {
          const pdfManager = new PDFManager(mergedConfig);
          const buffer = await readFile(filePath);

          const result = await pdfManager.processBuffer(
            buffer,
            fileName
          );
          count += 1
          console.log("Result for file", fileName, count)

          results[fileName] = result;
          logResults.push(result);
        } catch (error) {
          failedFiles.push(fileName);
          const errorResult = {
            fileName,
            totalPages: 0,
            results: {},
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error during scanning',
          };
          results[fileName] = errorResult;
          logResults.push(errorResult);
        }
      }

      // Log all results using global settings directory
      if (settings.directory && logResults.length > 0) {
        try {
          const logService = new LogService(settings.directory);
          await logService.logMultipleFiles(logResults);
        } catch (logError) {
          console.warn('Failed to log directory scan results:', logError);
          // Don't fail the scan if logging fails
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
