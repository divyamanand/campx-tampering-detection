import { ipcMain, BrowserWindow } from 'electron';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { PDFManagerConfig } from './services/PDFManager';
import { LogService } from './services/LogService';
import { getSettingsService } from './utils/SettingsService';
import { getWorkerPool } from './workers/WorkerPool';
import type { WorkerJob } from './workers/Job';
import { getOrchestrator } from './services/BatchOrchestrator';
import type { BatchSettings } from './types/BatchSettings';

export interface ScanProgress {
  fileName: string;
  pageNumber: number;
  totalPages: number;
}

/**
 * Initialize Scanner IPC Handlers
 *
 * These handlers delegate PDF processing to the worker pool,
 * which automatically:
 * - Queues jobs when all workers are busy
 * - Assigns to idle workers
 * - Maintains throughput with optimal parallelism
 *
 * The main process remains non-blocking and responsive for UI.
 */
export function initializeScannerHandlers(mainWindow?: BrowserWindow): void {
  /**
   * Single File Scan Handler
   * Submits job to worker pool
   */
  ipcMain.handle(
    'scan-pdf-file',
    async (_event, filePath: string, config: PDFManagerConfig = {}) => {
      const jobId = randomUUID();
      const fileName = path.basename(filePath);

      try {
        const settingsService = getSettingsService();
        const settings = settingsService.getSettings();

        // Merge global settings with runtime config
        const mergedConfig = {
          initialScale: config.initialScale ?? settings.initialScale,
          enableRotation: config.enableRotation ?? settings.enableRotation,
          rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
        };

        // Read file into buffer
        const fileBuffer = await readFile(filePath);

        // Get worker pool (auto-initializes if needed)
        const pool = getWorkerPool();

        // Create job for the pool
        const job: WorkerJob = {
          id: jobId,
          buffer: fileBuffer.buffer as ArrayBuffer,
          fileName,
          config: mergedConfig,
          resolve: () => {},
          reject: () => {},
          onProgress: (progressData) => {
            // Forward progress events to renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('scan-progress', progressData);
            }
          },
        };

        // Submit job to pool (auto-queues if workers are busy)
        const result = await pool.submit(job);

        console.log(`✓ Scan complete: ${fileName}`);

        // Log results if directory configured
        if (settings.directory) {
          try {
            const logService = new LogService(settings.directory);
            await logService.logFileProcess(result);
          } catch (logError) {
            console.warn('Failed to log results:', logError);
            // Don't fail scan if logging fails
          }
        }

        return result;
      } catch (error) {
        console.error(`✗ Scan failed: ${fileName}`, error);
        return {
          fileName,
          totalPages: 0,
          results: {},
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * Batch File Scan Handler
   * Submits multiple jobs to worker pool (auto-queues as needed)
   */
  ipcMain.handle(
    'scan-pdf-batch',
    async (_event, filePaths: string[], config: PDFManagerConfig = {}) => {
      const settingsService = getSettingsService();
      const settings = settingsService.getSettings();

      // Merge global settings with runtime config
      const mergedConfig = {
        initialScale: config.initialScale ?? settings.initialScale,
        enableRotation: config.enableRotation ?? settings.enableRotation,
        rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
      };

      const results: Record<string, unknown> = {};
      const failedFiles: string[] = [];
      const logResults: Array<any> = [];
      const pool = getWorkerPool();

      // Submit all jobs to pool (they'll queue automatically)
      const scanPromises = filePaths.map(async (filePath) => {
        const fileName = path.basename(filePath);
        const jobId = randomUUID();

        try {
          const fileBuffer = await readFile(filePath);

          const job: WorkerJob = {
            id: jobId,
            buffer: fileBuffer.buffer as ArrayBuffer,
            fileName,
            config: mergedConfig,
            resolve: () => {},
            reject: () => {},
            onProgress: (progressData) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-progress', progressData);
              }
            },
          };

          const result = await pool.submit(job);
          results[fileName] = result;
          logResults.push(result);
        } catch (error) {
          failedFiles.push(fileName);
          const errorResult = {
            fileName,
            totalPages: 0,
            results: {},
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          results[fileName] = errorResult;
          logResults.push(errorResult);
        }
      });

      // Wait for all jobs to complete
      await Promise.all(scanPromises);

      // Log all results if directory configured
      if (settings.directory && logResults.length > 0) {
        try {
          const logService = new LogService(settings.directory);
          await logService.logMultipleFiles(logResults);
        } catch (logError) {
          console.warn('Failed to log batch results:', logError);
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

  /**
   * Directory Scan Handler
   * Submits all PDFs in directory to worker pool (auto-queues as needed)
   */
  ipcMain.handle(
    'scan-directory',
    async (_event, dirPath: string, config: PDFManagerConfig = {}) => {
      const settingsService = getSettingsService();
      const settings = settingsService.getSettings();

      console.log('📁 Directory scan started:', dirPath);

      // Merge global settings with runtime config
      const mergedConfig = {
        initialScale: config.initialScale ?? settings.initialScale,
        enableRotation: config.enableRotation ?? settings.enableRotation,
        rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
      };

      try {
        // Discover PDF files
        const entries = await readdir(dirPath, { withFileTypes: true });
        const pdfFiles = entries
          .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
          .map((e) => e.name);

        console.log(`Found ${pdfFiles.length} PDF files`);

        const results: Record<string, unknown> = {};
        const failedFiles: string[] = [];
        const logResults: Array<any> = [];
        const pool = getWorkerPool();

        // Submit all PDFs to pool (they'll queue automatically)
        const scanPromises = pdfFiles.map(async (fileName) => {
          const filePath = path.join(dirPath, fileName);
          const jobId = randomUUID();

          try {
            const fileBuffer = await readFile(filePath);

            const job: WorkerJob = {
              id: jobId,
              buffer: fileBuffer.buffer as ArrayBuffer,
              fileName,
              config: mergedConfig,
              resolve: () => {},
              reject: () => {},
              onProgress: (progressData) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('scan-progress', progressData);
                }
              },
            };

            const result = await pool.submit(job);
            results[fileName] = result;
            logResults.push(result);
          } catch (error) {
            failedFiles.push(fileName);
            const errorResult = {
              fileName,
              totalPages: 0,
              results: {},
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
            results[fileName] = errorResult;
            logResults.push(errorResult);
          }
        });

        // Wait for all jobs to complete
        await Promise.all(scanPromises);

        // Log all results if directory configured
        if (settings.directory && logResults.length > 0) {
          try {
            const logService = new LogService(settings.directory);
            await logService.logMultipleFiles(logResults);
          } catch (logError) {
            console.warn('Failed to log results:', logError);
          }
        }

        console.log(
          `✓ Directory scan complete: ${pdfFiles.length - failedFiles.length}/${pdfFiles.length} succeeded`
        );

        return {
          scannedCount: pdfFiles.length - failedFiles.length,
          failedCount: failedFiles.length,
          failedFiles,
          results,
        };
      } catch (error) {
        console.error('✗ Directory scan failed:', error);
        throw error;
      }
    }
  );

  /**
   * Batch Processing Control Handlers
   * These handlers manage persistent directory scanning with the BatchOrchestrator
   */

  /**
   * Start batch processing
   * Begins persistent polling and batch processing of a directory
   */
  ipcMain.handle('batch-start', async (_event, batchSettings: BatchSettings) => {
    try {
      const orchestrator = getOrchestrator();

      // Register progress listener to forward to renderer
      orchestrator.onProgress((progressEvent) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('batch-progress', progressEvent);
        }
      });

      // Start batch processing
      await orchestrator.start(batchSettings);

      console.log(`✓ Batch processing started: ${batchSettings.directory}`);

      return { success: true, message: 'Batch processing started' };
    } catch (error) {
      console.error('Failed to start batch processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Pause batch processing
   * Pauses batch processing but keeps directory polling active
   */
  ipcMain.handle('batch-pause', async () => {
    try {
      const orchestrator = getOrchestrator();
      orchestrator.pause();

      console.log('✓ Batch processing paused');

      return { success: true, message: 'Batch processing paused' };
    } catch (error) {
      console.error('Failed to pause batch processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Resume batch processing
   * Resumes paused batch processing
   */
  ipcMain.handle('batch-resume', async () => {
    try {
      const orchestrator = getOrchestrator();
      orchestrator.resume();

      console.log('✓ Batch processing resumed');

      return { success: true, message: 'Batch processing resumed' };
    } catch (error) {
      console.error('Failed to resume batch processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Stop batch processing
   * Stops polling and processing, returns final results
   */
  ipcMain.handle('batch-stop', async () => {
    try {
      const orchestrator = getOrchestrator();
      const result = await orchestrator.stop();

      console.log('✓ Batch processing stopped');

      return { success: true, result };
    } catch (error) {
      console.error('Failed to stop batch processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Get batch state
   * Returns current state of batch processing
   */
  ipcMain.handle('batch-get-state', async () => {
    try {
      const orchestrator = getOrchestrator();
      const state = orchestrator.getState();

      return { success: true, state };
    } catch (error) {
      console.error('Failed to get batch state:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
