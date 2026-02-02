/**
 * ScannerService - Wrapper for scanner IPC handlers
 *
 * Provides a clean API to invoke scanner functionality from the main process
 */

export interface PDFManagerConfig {
  initialScale?: number;
  enableRotation?: boolean;
  rotationDegrees?: number;
}

export interface ScanResult {
  fileName: string;
  totalPages: number;
  results: Record<string, unknown>;
  success: boolean;
  error?: string;
}

export interface BatchScanResult {
  allResults: Record<string, ScanResult>;
  failedFiles: string[];
  successCount: number;
  failureCount: number;
}

export interface DirectoryScanResult {
  scannedCount: number;
  failedCount: number;
  failedFiles: string[];
  results: Record<string, ScanResult>;
}

class ScannerService {
  /**
   * Scan a single PDF file
   *
   * Results will be automatically logged to the directory specified in global settings
   *
   * @param filePath - Full path to the PDF file
   * @param config - PDFManager configuration options
   * @returns Scan result with detailed page information
   */
  async scanSingleFile(
    filePath: string,
    config: PDFManagerConfig = {}
  ): Promise<ScanResult> {
    return window.electronAPI.invoke('scan-pdf-file', filePath, config);
  }

  /**
   * Scan multiple PDF files in batch
   *
   * Sends 'scan-progress' events to track real-time progress
   * Results will be automatically logged to the directory specified in global settings
   *
   * @param filePaths - Array of full paths to PDF files
   * @param config - PDFManager configuration options
   * @returns Batch scan results with summary statistics
   */
  async scanBatch(
    filePaths: string[],
    config: PDFManagerConfig = {}
  ): Promise<BatchScanResult> {
    return window.electronAPI.invoke('scan-pdf-batch', filePaths, config);
  }

  /**
   * Scan all PDF files in a directory
   *
   * Sends 'scan-progress' events to track real-time progress
   * Results will be automatically logged to the directory specified in global settings
   *
   * @param dirPath - Full path to directory containing PDF files
   * @param config - PDFManager configuration options
   * @returns Directory scan results with summary statistics
   */
  async scanDirectory(
    dirPath: string,
    config: PDFManagerConfig = {}
  ): Promise<DirectoryScanResult> {
    return window.electronAPI.invoke('scan-directory', dirPath, config);
  }

  /**
   * Listen for scan progress events
   *
   * @param callback - Function called with progress data
   * @returns Cleanup function to remove listener
   */
  onScanProgress(
    callback: (data: { filePath: string; fileName: string; pageNumber: number; totalPages: number }) => void
  ): () => void {
    window.electronAPI.on('scan-progress', callback);
    // Note: We can't unsubscribe because the preload script doesn't expose an 'off' method
    // TODO: Add 'off' method to preload script for proper cleanup
    return () => {
      // Placeholder for cleanup
    };
  }
}

// Export singleton instance
export const scannerService = new ScannerService();
