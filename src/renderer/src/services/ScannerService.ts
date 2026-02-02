/**
 * ScannerService - Batch Processing API
 *
 * Provides a clean API to invoke batch processing functionality from the main process.
 * Uses the complete BatchOrchestrator pipeline with:
 * - PDF scanning workers
 * - Verification (tampering detection)
 * - File routing (tampered/retry/scan_passed)
 * - Crash-safe logging
 */

import type { BatchSettings, BatchState, BatchResult } from '../../../main/types/batchSettings.types';

/**
 * Batch processing response
 */
export interface BatchResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  result?: T;
}

class ScannerService {
  /**
   * Start batch directory scanning with verification and routing
   *
   * Begins persistent polling of the specified directory.
   * Files are processed in batches, verified for tampering, and routed to appropriate folders.
   *
   * @param settings - Batch configuration (directory, batch size, polling interval, PDF config)
   * @returns Response with success status
   */
  async startBatch(settings: BatchSettings): Promise<BatchResponse> {
    return (await window.electronAPI.invoke('batch-start', settings)) as BatchResponse;
  }

  /**
   * Pause batch processing
   *
   * Pauses processing but keeps directory polling active.
   * Can be resumed without restarting the scan.
   *
   * @returns Response with success status
   */
  async pauseBatch(): Promise<BatchResponse> {
    return (await window.electronAPI.invoke('batch-pause')) as BatchResponse;
  }

  /**
   * Resume batch processing
   *
   * Resumes paused batch processing from where it was paused.
   *
   * @returns Response with success status
   */
  async resumeBatch(): Promise<BatchResponse> {
    return (await window.electronAPI.invoke('batch-resume')) as BatchResponse;
  }

  /**
   * Stop batch processing
   *
   * Stops polling and processing, returns final results.
   *
   * @returns Response with batch result
   */
  async stopBatch(): Promise<BatchResponse<BatchResult>> {
    return (await window.electronAPI.invoke('batch-stop')) as BatchResponse<BatchResult>;
  }

  /**
   * Get current batch state
   *
   * Returns the current state of batch processing including:
   * - Active/paused status
   * - Total/processed/queued file counts
   * - Batch index
   * - Elapsed time
   *
   * @returns Response with batch state
   */
  async getBatchState(): Promise<BatchResponse<BatchState>> {
    return (await window.electronAPI.invoke('batch-get-state')) as BatchResponse<BatchState>;
  }

  /**
   * Listen for batch progress events
   *
   * Emitted during batch processing with real-time statistics:
   * - Files processed in current batch
   * - Total files processed
   * - Queue size
   * - Throughput (files/sec)
   * - Estimated time remaining
   *
   * @param callback - Function called with progress data
   * @returns Cleanup function (no-op, IPC doesn't support unsubscribe)
   */
  onBatchProgress(callback: (data: unknown) => void): () => void {
    window.electronAPI.on('batch-progress', callback);
    // Note: The current IPC setup doesn't provide an 'off' method
    // This is a limitation that could be improved in future
    return () => {
      // Placeholder for cleanup
    };
  }
}

// Export singleton instance
export const scannerService = new ScannerService();
