/**
 * LogWriter - Handles reading and writing logs using Electron IPC
 *
 * This class provides static methods for managing application logs in timestamped
 * log files. It transforms processing results from PDFManager into a standardized
 * log format and communicates with the main process via IPC for file system operations.
 */

declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      send: (channel: string, ...args: unknown[]) => void
      on: (channel: string, listener: (...args: unknown[]) => void) => void
    }
  }
}

interface CodeObject {
  [format: string]: string
}

interface LogEntry {
  success: boolean
  errors: string[]
  codes: CodeObject[]
}

interface TransformedLogs {
  [pageNumber: string]: LogEntry
}

interface FileResult {
  success: boolean
  totalPages: number
  results: Record<string, unknown>
  error?: string
}

interface CodeCount {
  QRCode: number
  Code128: number
}

interface BestCounts {
  [pageNumber: string]: CodeCount
}

interface VerificationResult {
  filesToRetry: Record<string, number[]>
  bestCounts: BestCounts
}

class LogWriter {
  /**
   * Opens a directory picker dialog allowing the user to select the processing directory
   *
   * @async
   * @returns {Promise<string>} Path to the selected directory
   * @throws {Error} If user cancels the picker
   *
   * @example
   * const dirPath = await LogWriter.selectLogsDirectory();
   */
  static async selectLogsDirectory(): Promise<string> {
    try {
      const dirPath = (await window.electronAPI.invoke('select-directory')) as string;
      return dirPath;
    } catch (error) {
      throw new Error(`Failed to select directory: ${(error as Error).message}`);
    }
  }

  /**
   * Creates the logs folder inside the selected directory
   *
   * @async
   * @param {string} dirPath - Path to the base directory
   * @returns {Promise<string>} Path to the logs directory
   * @throws {Error} If folder creation fails
   */
  static async createLogsFolder(dirPath: string): Promise<string> {
    try {
      const logsPath = (await window.electronAPI.invoke('create-logs-folder', dirPath)) as string;
      return logsPath;
    } catch (error) {
      throw new Error(`Failed to create logs folder: ${(error as Error).message}`);
    }
  }

  /**
   * Reads a specific log file from the logs directory
   *
   * @async
   * @param {string} dirPath - Path to the base directory
   * @param {string} logFileName - Name of the log file to read
   * @returns {Promise<Object>} Parsed logs object, or empty object {} if file doesn't exist
   * @throws {Error} If file read fails or JSON parsing fails
   *
   * @example
   * const logs = await LogWriter.readLogsFile('/path/to/dir', 'logs_20240115_143022.json');
   */
  static async readLogsFile(dirPath: string, logFileName: string): Promise<Record<string, TransformedLogs>> {
    try {
      const logsData = (await window.electronAPI.invoke('read-log-file', dirPath, logFileName)) as Record<string, TransformedLogs>;
      return logsData;
    } catch (error) {
      throw new Error(`Failed to read log file: ${(error as Error).message}`);
    }
  }

  /**
   * Writes logs to a timestamped log file in the logs directory
   *
   * @async
   * @param {string} dirPath - Path to the base directory
   * @param {Object} logs - Logs object to write to file
   * @returns {Promise<string>} The filename that was created
   * @throws {Error} If file write fails
   *
   * @example
   * const fileName = await LogWriter.writeLogsFile('/path/to/dir', logs);
   */
  static async writeLogsFile(
    dirPath: string,
    logs: Record<string, TransformedLogs>
  ): Promise<string> {
    try {
      const fileName = (await window.electronAPI.invoke('write-log-file', dirPath, logs)) as string;
      return fileName;
    } catch (error) {
      throw new Error(`Failed to write log file: ${(error as Error).message}`);
    }
  }

  /**
   * Transforms a PDFManager.processFile() result into the standardized log format
   *
   * The input format contains page-level results with processing metadata.
   * The output format contains only the log-relevant data (success status, errors, codes).
   *
   * @param {Object} fileResult - Result object from PDFManager.processFile()
   * @returns {Object} Transformed log object with format:
   *   {
   *     "pageNumber": {
   *       success: boolean,
   *       errors: string[],
   *       codes: Array<{[format]: string}>
   *     }
   *   }
   *
   * @example
   * const logData = LogWriter.transformResults(fileResult);
   * // Returns: { "1": { success: true, errors: [], codes: [{QRCode: "ABC123"}] }, ... }
   */
  static transformResults(fileResult: FileResult): TransformedLogs {
    const transformedLogs: TransformedLogs = {};

    if (!fileResult || !fileResult.results) {
      return transformedLogs;
    }

    Object.entries(fileResult.results).forEach(([pageNumber, pageResult]) => {
      const pageResultData = pageResult as Record<string, unknown> & { result?: Record<string, unknown>; success?: boolean };
      const logEntry: LogEntry = {
        success: pageResultData.success || false,
        errors: [],
        codes: [],
      };

      if (pageResultData.result) {
        const resultData = pageResultData.result as Record<string, unknown> & { success?: boolean; codes?: Array<{ format: string; data: string }>; error?: string };

        // Handle success case
        if (resultData.success && resultData.codes) {
          logEntry.codes = resultData.codes.map((code) => ({
            [code.format]: code.data,
          }));
        }

        // Handle error case
        if (resultData.error) {
          logEntry.errors.push(resultData.error);
        }
      }

      transformedLogs[pageNumber] = logEntry;
    });

    return transformedLogs;
  }

  /**
   * Main method that orchestrates transforming and writing file results to a log file
   *
   * This is the primary entry point for logging file processing results.
   * It handles the complete workflow: transform new results and write to a timestamped log file.
   *
   * @async
   * @param {string} dirPath - Path to the base directory
   * @param {string} logFileName - The log filename to append to (if first file, creates new log)
   * @param {string} fileName - Name of the processed file (used as log key)
   * @param {Object} fileResult - Result object from PDFManager.processFile()
   * @returns {Promise<{logs: Record<string, TransformedLogs>, logFileName: string}>} Updated logs and filename
   * @throws {Error} If any step of the process fails
   *
   * @example
   * const { logs, logFileName } = await LogWriter.appendFileResults(
   *   '/path/to/dir',
   *   'logs_20240115_143022.json',
   *   'document.pdf',
   *   pdfProcessingResult
   * );
   */
  static async appendFileResults(
    dirPath: string,
    logFileName: string | null,
    fileName: string,
    fileResult: FileResult
  ): Promise<{ logs: Record<string, TransformedLogs>; logFileName: string }> {
    try {
      let logs: Record<string, TransformedLogs>;
      let currentLogFileName = logFileName;

      // Step 1: Read existing logs if filename provided, otherwise start fresh
      if (currentLogFileName) {
        logs = await LogWriter.readLogsFile(dirPath, currentLogFileName);
      } else {
        logs = {};
      }

      // Step 2: Transform the new results
      const transformedResults = LogWriter.transformResults(fileResult);

      // Step 3: Append/update the file entry in logs
      logs[fileName] = transformedResults;

      // Step 4: Write updated logs back to file (creates new file if no filename, returns filename)
      if (!currentLogFileName) {
        currentLogFileName = await LogWriter.writeLogsFile(dirPath, logs);
      } else {
        await LogWriter.writeLogsFile(dirPath, logs);
      }

      return { logs, logFileName: currentLogFileName };
    } catch (error) {
      throw new Error(`Failed to append file results: ${(error as Error).message}`);
    }
  }

  /**
   * Verification function to identify pages that need to be retried
   *
   * This function analyzes the log file to find the maximum (best) count
   * of codes per page number across all files. Then identifies files where the
   * count is less than the best count, indicating potential processing failures.
   *
   * @async
   * @param {string} dirPath - Path to the base directory
   * @param {string} logFileName - Name of the log file to verify
   * @returns {Promise<Object>} Object with structure:
   *   {
   *     filesToRetry: { fileName: [pageNumbers] },
   *     bestCounts: { pageNumber: { QRCode: count, Code128: count } }
   *   }
   * @throws {Error} If reading logs fails
   *
   * @example
   * const verification = await LogWriter.verifyAndGetRetryPages('/path/to/dir', 'logs_20240115_143022.json');
   * // Returns: {
   * //   filesToRetry: { 'doc1.pdf': [1, 3], 'doc2.pdf': [2] },
   * //   bestCounts: { '1': { QRCode: 2, Code128: 1 }, ... }
   * // }
   */
  static async verifyAndGetRetryPages(dirPath: string, logFileName: string): Promise<VerificationResult> {
    try {
      const result = (await window.electronAPI.invoke('verify-logs', dirPath, logFileName)) as VerificationResult;
      return result;
    } catch (error) {
      throw new Error(`Failed to verify logs: ${(error as Error).message}`);
    }
  }
}

export { LogWriter };
