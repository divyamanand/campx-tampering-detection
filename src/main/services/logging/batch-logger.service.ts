/**
 * Batch Logger - Simple append-only logging
 *
 * Architecture:
 * - Single logs.json file in directory/logs/
 * - Each entry keyed by fileName
 * - Simple append operations
 * - No batch management, headers, or summaries
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import type { LogEntry } from '../../types/logEntry.types';

/**
 * BatchLogger - Manages logging for batch processing
 */
export class BatchLogger {
  /**
   * Path to logs directory
   */
  private logsDirectory: string;

  /**
   * Path to logs.json file
   */
  private logsFilePath: string;

  /**
   * In-memory entries for current batch
   */
  private entries: Record<string, LogEntry> = {};

  /**
   * Create logger for a specific directory
   */
  constructor(directory: string) {
    this.logsDirectory = path.join(directory, 'logs');
    this.logsFilePath = path.join(this.logsDirectory, 'logs.json');
  }

  /**
   * Initialize a new batch
   * Returns batch ID (not used but kept for API compatibility)
   */
  async startBatch(_batchSettings: {
    directory: string;
    batchSize: number;
    pollingIntervalMs: number;
    totalFiles: number;
  }): Promise<string> {
    // Clear entries for new batch
    this.entries = {};

    // Create logs directory if needed
    try {
      await mkdir(this.logsDirectory, { recursive: true });
    } catch (error) {
      console.warn('[Logger] Failed to create logs directory:', error);
    }

    return 'batch-' + Date.now();
  }

  /**
   * Add a log entry for a completed file
   * Stored in memory until batch completes
   */
  addEntry(entry: LogEntry): void {
    if (!entry.fileName) {
      console.error('[Logger] Entry missing fileName, dropping');
      return;
    }

    // Store entry with fileName as key
    this.entries[entry.fileName] = entry;
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return Object.keys(this.entries).length;
  }

  /**
   * Complete batch and flush logs to disk
   * Appends entries to logs.json
   */
  async completeBatch(_status?: 'COMPLETED' | 'FAILED' | 'CANCELLED', _error?: Error): Promise<void> {
    try {
      // Read existing logs.json if it exists
      let allLogs: Record<string, LogEntry> = {};

      try {
        const content = await readFile(this.logsFilePath, 'utf-8');
        allLogs = JSON.parse(content);
      } catch {
        // File doesn't exist yet or can't be parsed, start fresh
        allLogs = {};
      }

      // Merge current batch entries into all logs
      allLogs = { ...allLogs, ...this.entries };

      // Write merged logs back to file
      await writeFile(this.logsFilePath, JSON.stringify(allLogs, null, 2));

      // Clear entries
      this.entries = {};
    } catch (error) {
      console.error('[Logger] Failed to complete batch:', error);
    }
  }

  /**
   * Read logs from file
   */
  async readLogs(): Promise<Record<string, LogEntry>> {
    try {
      const content = await readFile(this.logsFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('[Logger] Failed to read logs:', error);
      return {};
    }
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    try {
      await writeFile(this.logsFilePath, JSON.stringify({}, null, 2));
    } catch (error) {
      console.error('[Logger] Failed to clear logs:', error);
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
