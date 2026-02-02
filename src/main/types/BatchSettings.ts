/**
 * Batch Processing Settings
 *
 * Configuration for persistent directory polling and batch scanning
 */

import type { PDFManagerConfig } from '../services/PDFManager';

/**
 * Settings for batch directory scanning
 * Controls polling, batching, and processing behavior
 */
export interface BatchSettings {
  /**
   * Directory to poll for PDF files
   * Required - must exist and be readable
   */
  directory: string;

  /**
   * Number of files to process per batch
   * Determines memory usage and worker utilization
   * Recommended: 4-10 (test on target hardware)
   *
   * Example:
   * - batchSize=4: 4 files → workers, repeat
   * - batchSize=10: 10 files → workers, repeat
   */
  batchSize: number;

  /**
   * How often to poll directory for new files (milliseconds)
   * Lower = more responsive, higher = less CPU
   *
   * Recommended: 5000 (5 seconds)
   * Range: 1000-60000
   *
   * Example:
   * - 1000: Check every 1 second (aggressive)
   * - 5000: Check every 5 seconds (balanced)
   * - 30000: Check every 30 seconds (lazy)
   */
  pollingIntervalMs: number;

  /**
   * Whether to scan subdirectories recursively
   * Default: false (only root directory)
   */
  recursive?: boolean;

  /**
   * PDF processing configuration
   * Applied to all files in batch
   * Overrides global settings during batch
   */
  pdfConfig?: PDFManagerConfig;
}

/**
 * Batch processing state
 */
export interface BatchState {
  /**
   * Whether batch processing is running
   */
  active: boolean;

  /**
   * Whether batch processing is paused
   */
  paused: boolean;

  /**
   * Total files discovered in directory
   */
  totalFiles: number;

  /**
   * Files processed so far
   */
  processedFiles: number;

  /**
   * Files currently in queue waiting to be processed
   */
  queuedFiles: number;

  /**
   * Current batch number
   */
  currentBatchIndex: number;

  /**
   * Time when batch started (Date.now())
   */
  startedAt?: number;

  /**
   * Elapsed time in milliseconds
   */
  elapsedMs: number;
}

/**
 * Progress event emitted during batch processing
 */
export interface BatchProgressEvent {
  /**
   * Event type identifier
   */
  type: 'batch-progress' | 'batch-complete' | 'batch-error';

  /**
   * Files processed in current batch
   */
  processedInBatch: number;

  /**
   * Total files processed so far
   */
  totalProcessed: number;

  /**
   * Total files found in directory
   */
  totalFiles: number;

  /**
   * Current batch index (1-based)
   */
  batchIndex: number;

  /**
   * Files still in queue
   */
  queuedFiles: number;

  /**
   * Elapsed time in milliseconds
   */
  elapsedMs: number;

  /**
   * Current throughput (files per second)
   */
  throughputPerSec?: number;

  /**
   * Estimated time remaining (minutes)
   */
  estimatedRemainingMins?: number;

  /**
   * Error message (if type === 'batch-error')
   */
  error?: string;
}

/**
 * Batch processing result
 */
export interface BatchResult {
  /**
   * Whether batch completed successfully
   */
  success: boolean;

  /**
   * Total files processed
   */
  totalProcessed: number;

  /**
   * Files that failed to process
   */
  failedCount: number;

  /**
   * Files that succeeded
   */
  successCount: number;

  /**
   * Total elapsed time (milliseconds)
   */
  totalElapsedMs: number;

  /**
   * Average time per file (milliseconds)
   */
  averageTimePerFileMs: number;

  /**
   * Error message if batch failed
   */
  error?: string;
}

/**
 * Default batch settings
 */
export const DEFAULT_BATCH_SETTINGS: Partial<BatchSettings> = {
  batchSize: 4,
  pollingIntervalMs: 5000,
  recursive: false,
};
