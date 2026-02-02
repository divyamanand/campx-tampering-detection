import { ipcMain, BrowserWindow } from 'electron';
import { getOrchestrator } from './services/orchestration/batch-orchestrator.service';
import type { BatchSettings } from './types/batchSettings.types';

/**
 * Initialize Scanner IPC Handlers
 *
 * Batch Processing Handlers
 * These handlers manage persistent directory scanning with the BatchOrchestrator:
 * - Verification (tampering detection)
 * - File routing (tampered/scan_passed directories)
 * - Crash-safe logging with resume capability
 * - Pause/Resume/Stop controls
 *
 * Architecture:
 * orchestrator.emitProgress() → orchestrator.onProgress() callbacks → IPC bridge → renderer
 */
export function initializeScannerHandlers(mainWindow?: BrowserWindow): void {
  // Track if progress listener is already registered (prevent duplicates)
  let progressListenerRegistered = false;

  /**
   * Batch Processing Control Handlers
   * These handlers manage persistent directory scanning with the BatchOrchestrator
   */

  /**
   * Start batch processing
   * Begins persistent polling and batch processing of a directory
   *
   * IPC Flow:
   * 1. Register progress callback (IPC bridge) - only once
   * 2. Start orchestrator
   * 3. orchestrator.emitProgress() calls the callback
   * 4. Callback sends to renderer via mainWindow.webContents.send('batch-progress')
   */
  ipcMain.handle('batch-start', async (_event, batchSettings: BatchSettings) => {
    try {
      const orchestrator = getOrchestrator();

      // Register progress listener to forward to renderer (only once)
      if (!progressListenerRegistered) {
        console.log('[Scanner] Registering progress callback (IPC bridge)');

        orchestrator.onProgress((progressEvent) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            // This is the actual IPC emission to renderer
            mainWindow.webContents.send('batch-progress', progressEvent);
            console.log(
              `[Scanner IPC] Sent batch-progress: ${progressEvent.type} ` +
              `(${progressEvent.totalProcessed}/${progressEvent.totalFiles})`
            );
          }
        });

        progressListenerRegistered = true;
      }

      // Start batch processing (will call emitProgress internally)
      await orchestrator.start(batchSettings);

      console.log(`✓ [Scanner] Batch processing started: ${batchSettings.directory}`);

      return { success: true, message: 'Batch processing started' };
    } catch (error) {
      console.error('[Scanner] Failed to start batch processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Pause batch processing
   * Pauses batch processing but keeps directory polling active
   *
   * Emits: batch-progress event with paused state
   */
  ipcMain.handle('batch-pause', async () => {
    try {
      const orchestrator = getOrchestrator();
      orchestrator.pause();

      console.log('[Scanner] ✓ Batch processing paused');

      return { success: true, message: 'Batch processing paused' };
    } catch (error) {
      console.error('[Scanner] Failed to pause batch processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Resume batch processing
   * Resumes paused batch processing
   *
   * Emits: batch-progress event with resumed state
   */
  ipcMain.handle('batch-resume', async () => {
    try {
      const orchestrator = getOrchestrator();
      orchestrator.resume();

      console.log('[Scanner] ✓ Batch processing resumed');

      return { success: true, message: 'Batch processing resumed' };
    } catch (error) {
      console.error('[Scanner] Failed to resume batch processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Stop batch processing
   * Stops polling and processing, returns final results
   *
   * Emits: batch-progress event with final stats
   */
  ipcMain.handle('batch-stop', async () => {
    try {
      const orchestrator = getOrchestrator();
      const result = await orchestrator.stop();

      console.log('[Scanner] ✓ Batch processing stopped');

      return { success: true, result };
    } catch (error) {
      console.error('[Scanner] Failed to stop batch processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Get batch state
   * Returns current state of batch processing
   *
   * Used by renderer polling (useBatchScan hook)
   * Provides complementary state info alongside progress events
   */
  ipcMain.handle('batch-get-state', async () => {
    try {
      const orchestrator = getOrchestrator();
      const state = orchestrator.getState();

      return { success: true, result: state };
    } catch (error) {
      console.error('[Scanner] Failed to get batch state:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
