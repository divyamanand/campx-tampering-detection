import { ipcMain, BrowserWindow } from 'electron';
import { getOrchestrator } from './services/orchestration/batch-orchestrator.service';
import type { BatchSettings } from './types/BatchSettings';

/**
 * Initialize Scanner IPC Handlers
 *
 * Batch Processing Handlers
 * These handlers manage persistent directory scanning with the BatchOrchestrator:
 * - Verification (tampering detection)
 * - File routing (tampered/retry/scan_passed directories)
 * - Crash-safe logging with resume capability
 * - Pause/Resume/Stop controls
 */
export function initializeScannerHandlers(mainWindow?: BrowserWindow): void {

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
