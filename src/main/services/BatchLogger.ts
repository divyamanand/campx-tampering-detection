/**
 * Batch Logger - Crash-safe, batch-aware logging
 *
 * Architecture:
 * - Workers return data, don't write logs
 * - Orchestrator owns log buffer
 * - In-memory entries during batch
 * - Flush to disk after batch completes
 * - Header written immediately (crash safety)
 * - Enables future resume functionality
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  LogEntry,
  BatchLogHeader,
  BatchLogFile,
  LogBuffer,
  ProcessingStatus,
} from '../types/LogEntry';
import { createBatchLogHeader, calculateLogStats, createLogEntry } from '../types/LogEntry';

/**
 * BatchLogger - Manages logging for batch processing
 */
export class BatchLogger {
  /**
   * Directory where batch logs are stored
   */
  private logsDirectory: string;

  /**
   * Current in-memory buffer
   */
  private buffer: LogBuffer | null = null;

  /**
   * Create logger for a specific directory
   */
  constructor(directory: string) {
    this.logsDirectory = path.join(directory, 'logs', 'batches');
  }

  /**
   * Initialize a new batch (STEP 4.6 - Crash safety)
   * Writes header immediately to enable crash recovery
   */
  async startBatch(batchSettings: {
    directory: string;
    batchSize: number;
    pollingIntervalMs: number;
    totalFiles: number;
  }): Promise<string> {
    const batchId = randomUUID();

    // Create buffer
    const header = createBatchLogHeader(batchId, {
      batchSettings,
      totalFiles: batchSettings.totalFiles,
    });

    this.buffer = {
      batchId,
      header,
      entries: [],
      flushed: false,
      lastEntryTime: Date.now(),
    };

    // Create logs directory if needed
    try {
      await mkdir(this.logsDirectory, { recursive: true });
    } catch (error) {
      console.warn('Failed to create logs directory:', error);
      // Continue anyway - may fail on flush but that's ok
    }

    // Write header immediately (crash safety)
    // This proves the batch was started
    try {
      const headerFile = this.getLogFilePath(batchId);
      const initialLog: BatchLogFile = {
        version: '1.0',
        header: { ...header, status: 'STARTED' },
        entries: [],
      };

      await writeFile(headerFile, JSON.stringify(initialLog, null, 2));
      console.log(`[Logger] Batch started: ${batchId}`);
    } catch (error) {
      console.warn(`[Logger] Failed to write batch header: ${error}`);
      // Don't fail the batch if logging fails
    }

    return batchId;
  }

  /**
   * Add a log entry for a completed file
   * Kept in memory until batch ends
   */
  addEntry(entry: LogEntry): void {
    if (!this.buffer) {
      console.warn('[Logger] No active batch, entry dropped');
      return;
    }

    // Validate entry
    if (!entry.status) {
      console.error('[Logger] Entry missing status, dropping');
      return;
    }

    // Add to buffer
    this.buffer.entries.push(entry);
    this.buffer.lastEntryTime = Date.now();

    console.log(`[Logger] Entry added: ${entry.fileName} (${entry.status})`);
  }

  /**
   * Get current buffer size
   * Used for progress calculation (STEP 4.8)
   */
  getBufferSize(): number {
    return this.buffer?.entries.length || 0;
  }

  /**
   * Complete batch and flush logs to disk (STEP 4.5)
   * Finalizes the batch log file with all entries
   */
  async completeBatch(status: 'COMPLETED' | 'FAILED' | 'CANCELLED', error?: Error): Promise<void> {
    if (!this.buffer) {
      console.warn('[Logger] No active batch to complete');
      return;
    }

    const batchId = this.buffer.batchId;

    try {
      // Finalize header
      this.buffer.header.status = status;
      this.buffer.header.endTime = Date.now();

      if (error) {
        this.buffer.header.error = {
          message: error.message,
          timestamp: Date.now(),
        };
      }

      // Calculate statistics
      const stats = calculateLogStats(this.buffer.entries);

      // Create final log file
      const finalLog: BatchLogFile = {
        version: '1.0',
        header: this.buffer.header,
        entries: this.buffer.entries,
        stats,
      };

      // Write to disk
      const logFile = this.getLogFilePath(batchId);
      await writeFile(logFile, JSON.stringify(finalLog, null, 2));

      this.buffer.flushed = true;

      console.log(
        `[Logger] Batch completed: ${batchId} (${this.buffer.entries.length} files, ${status})`
      );
    } catch (error) {
      console.error('[Logger] Failed to complete batch:', error);
      // Don't throw - batch already processed
    } finally {
      // Clear buffer
      this.buffer = null;
    }
  }

  /**
   * Get log file path for a batch
   * Format: logs/batches/batch_YYYY-MM-DDTHH-MM-SS.json
   */
  private getLogFilePath(batchId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];
    return path.join(this.logsDirectory, `batch_${timestamp}.json`);
  }

  /**
   * Read batch log from disk (for debugging/recovery)
   */
  async readBatchLog(batchId: string): Promise<BatchLogFile | null> {
    try {
      // Find the file (we need to search since we don't store exact names)
      // For now, this is a placeholder
      // In production, you'd maintain an index
      return null;
    } catch (error) {
      console.error('[Logger] Failed to read batch log:', error);
      return null;
    }
  }

  /**
   * Scan logs directory to detect incomplete batches (STEP 4.7)
   * Returns list of incomplete batches that could be resumed
   */
  async detectIncompleteBatches(): Promise<BatchLogFile[]> {
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(this.logsDirectory);

      const incompleteBatches: BatchLogFile[] = [];

      for (const file of files) {
        try {
          const filePath = path.join(this.logsDirectory, file);
          const content = await readFile(filePath, 'utf-8');
          const logFile: BatchLogFile = JSON.parse(content);

          // Check if batch is incomplete
          if (logFile.header.status === 'STARTED') {
            incompleteBatches.push(logFile);
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      return incompleteBatches;
    } catch (error) {
      console.warn('[Logger] Failed to scan logs directory:', error);
      return [];
    }
  }

  /**
   * Get processed files from logs (for resume logic)
   * Extracts filenames from successful entries
   */
  async getProcessedFiles(): Promise<Set<string>> {
    try {
      const incompleteBatches = await this.detectIncompleteBatches();
      const processed = new Set<string>();

      for (const batch of incompleteBatches) {
        for (const entry of batch.entries) {
          if (entry.status === 'SUCCESS' || entry.status === 'PARTIAL') {
            processed.add(entry.absolutePath);
          }
        }
      }

      return processed;
    } catch (error) {
      console.warn('[Logger] Failed to get processed files:', error);
      return new Set();
    }
  }
}

/**
 * Global logger instance
 */
let loggerInstance: BatchLogger | null = null;

/**
 * Get or create logger for directory
 */
export function getBatchLogger(directory: string): BatchLogger {
  if (!loggerInstance) {
    loggerInstance = new BatchLogger(directory);
  }
  return loggerInstance;
}
