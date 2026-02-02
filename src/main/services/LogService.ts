import fs from 'fs/promises';
import path from 'path';

export interface FileProcessLog {
  fileName: string;
  totalPages: number;
  results: Record<number, any>;
  success: boolean;
  error?: string;
  timestamp?: string;
}

export interface LogsData {
  [fileName: string]: FileProcessLog;
}

/**
 * LogService - Handles logging of PDF processing results
 *
 * Manages logs.json file creation and updates with scan results
 */
export class LogService {
  private logsFilePath: string;

  constructor(logsDirectory: string) {
    this.logsFilePath = path.join(logsDirectory, 'logs.json');
  }

  /**
   * Read existing logs from file, or return empty object if file doesn't exist
   */
  private async readLogs(): Promise<LogsData> {
    try {
      const fileContent = await fs.readFile(this.logsFilePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is invalid JSON
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      // If file exists but is invalid JSON, return empty and log warning
      console.warn(`Warning: logs.json is invalid, starting fresh: ${error}`);
      return {};
    }
  }

  /**
   * Write logs to file
   */
  private async writeLogs(logs: LogsData): Promise<void> {
    try {
      // Ensure directory exists
      const logsDir = path.dirname(this.logsFilePath);
      await fs.mkdir(logsDir, { recursive: true });

      // Write logs to file
      await fs.writeFile(
        this.logsFilePath,
        JSON.stringify(logs, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to write logs:', error);
      throw new Error(
        `Failed to write logs: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Log the results of a PDF processing operation
   *
   * @param fileResults - The processing result from PDFManager
   */
  async logFileProcess(fileResults: {
    fileName: string;
    totalPages: number;
    results: Record<number, any>;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      // Read existing logs
      const logs = await this.readLogs();

      // Create log entry with timestamp
      const logEntry: FileProcessLog = {
        fileName: fileResults.fileName,
        totalPages: fileResults.totalPages,
        results: fileResults.results,
        success: fileResults.success,
        error: fileResults.error,
        timestamp: new Date().toISOString(),
      };

      // Add or update the file entry
      logs[fileResults.fileName] = logEntry;

      // Write updated logs
      await this.writeLogs(logs);

      console.log(`✓ Logged results for: ${fileResults.fileName}`);
    } catch (error) {
      console.error('Failed to log file process:', error);
      throw error;
    }
  }

  /**
   * Log multiple file processing results
   */
  async logMultipleFiles(fileResults: Array<{
    fileName: string;
    totalPages: number;
    results: Record<number, any>;
    success: boolean;
    error?: string;
  }>): Promise<void> {
    try {
      // Read existing logs
      const logs = await this.readLogs();

      // Add all file entries
      for (const result of fileResults) {
        const logEntry: FileProcessLog = {
          fileName: result.fileName,
          totalPages: result.totalPages,
          results: result.results,
          success: result.success,
          error: result.error,
          timestamp: new Date().toISOString(),
        };

        logs[result.fileName] = logEntry;
      }

      // Write updated logs
      await this.writeLogs(logs);

      console.log(`✓ Logged results for ${fileResults.length} files`);
    } catch (error) {
      console.error('Failed to log multiple files:', error);
      throw error;
    }
  }

  /**
   * Get all logs
   */
  async getAllLogs(): Promise<LogsData> {
    return this.readLogs();
  }

  /**
   * Get logs for a specific file
   */
  async getFileLogs(fileName: string): Promise<FileProcessLog | null> {
    const logs = await this.readLogs();
    return logs[fileName] || null;
  }

  /**
   * Clear all logs (delete logs.json file)
   */
  async clearLogs(): Promise<void> {
    try {
      await fs.unlink(this.logsFilePath);
      console.log('✓ Logs cleared');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get statistics from logs
   */
  async getStatistics(): Promise<{
    totalFiles: number;
    successfulScans: number;
    failedScans: number;
    totalPages: number;
    totalCodesFound: number;
  }> {
    const logs = await this.readLogs();
    const stats = {
      totalFiles: 0,
      successfulScans: 0,
      failedScans: 0,
      totalPages: 0,
      totalCodesFound: 0,
    };

    for (const log of Object.values(logs)) {
      stats.totalFiles++;
      stats.totalPages += log.totalPages;

      if (log.success) {
        stats.successfulScans++;
      } else {
        stats.failedScans++;
      }

      // Count total codes found across all pages
      Object.values(log.results).forEach((pageResult: any) => {
        if (pageResult.result?.codes) {
          stats.totalCodesFound += pageResult.result.codes.length;
        }
      });
    }

    return stats;
  }
}

/**
 * Factory function for convenience
 */
export function createLogService(logsDirectory: string): LogService {
  return new LogService(logsDirectory);
}
