import { useState } from "react";
import { createPDFManager } from "../PDFManager";
import { LogWriter } from "../LogWriter";

interface PageInfo {
  pageNumber: number
  totalPages: number
}

interface ProcessResult {
  fileName: string
  success: boolean
  totalPages: number
  results: Record<string, unknown>
  error: string | null
}

interface BatchProgress {
  status: "processing" | "completed" | "failed" | "queued"
  result: ProcessResult | null
}

interface FilePageProgress {
  currentPage: number
  totalPages: number
}

interface UseBatchProcessorReturn {
  processing: boolean
  results: ProcessResult[]
  currentBatch: File[]
  batchProgress: Record<string, BatchProgress>
  filePageProgress: Record<string, FilePageProgress>
  currentFileIndex: number
  totalFiles: number
  currentLogFileName: string | null
  processBatch: (
    selectedFiles: File[],
    onStart?: () => void,
    onComplete?: () => void
  ) => Promise<void>
  getSummary: () => { totalPages: number; successCount: number; failedCount: number }
  reset: () => void
}

/**
 * useBatchProcessor - Custom hook for batch PDF processing
 *
 * Single Responsibility: Manage batch processing state and logic
 * Only handles file processing - timer and logs directory managed separately (SRP)
 *
 * @param {number} batchSize - Number of files to process in parallel
 * @param {string} logsDirectory - Path to the directory for storing logs
 * @returns {Object} Batch processing state and methods
 */
export const useBatchProcessor = (
  batchSize = 5,
  logsDirectory: string | null = null
): UseBatchProcessorReturn => {
  // File processing state
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [currentBatch, setCurrentBatch] = useState<File[]>([]);
  const [batchProgress, setBatchProgress] = useState<Record<string, BatchProgress>>({});
  const [filePageProgress, setFilePageProgress] = useState<Record<string, FilePageProgress>>({});

  // Counter state
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  // Log file tracking
  const [currentLogFileName, setCurrentLogFileName] = useState<string | null>(null);

  /**
   * Process a single file with provided PDFManager instance
   */
  const processFileWithManager = async (
    file: File,
    pdfManager: ReturnType<typeof createPDFManager>,
    logFileName: string | null
  ): Promise<{ result: ProcessResult; logFileName: string | null }> => {
    try {
      // Mark file as processing
      setBatchProgress((prev) => ({
        ...prev,
        [file.name]: { status: "processing", result: null },
      }));

      // Initialize page progress tracking
      setFilePageProgress((prev) => ({
        ...prev,
        [file.name]: { currentPage: 0, totalPages: 0 },
      }));

      // Pass callback to track page completion
      const fileResult = await pdfManager.processFile(file, (pageInfo: PageInfo) => {
        // Update page progress in real-time
        setFilePageProgress((prev) => ({
          ...prev,
          [file.name]: {
            currentPage: pageInfo.pageNumber,
            totalPages: pageInfo.totalPages,
          },
        }));
      });

      const result: ProcessResult = {
        fileName: file.name,
        success: fileResult.success,
        totalPages: fileResult.totalPages,
        results: fileResult.results,
        error: fileResult.error || null,
      };

      // Mark file as complete
      setBatchProgress((prev) => ({
        ...prev,
        [file.name]: {
          status: fileResult.success ? "completed" : "failed",
          result,
        },
      }));

      // Append result to logs
      let resultLogFileName = logFileName;
      if (logsDirectory) {
        const { logFileName: newFileName } = await LogWriter.appendFileResults(
          logsDirectory,
          logFileName,
          file.name,
          result
        );
        resultLogFileName = newFileName;
      }

      return { result, logFileName: resultLogFileName };
    } catch (error) {
      const result: ProcessResult = {
        fileName: file.name,
        success: false,
        totalPages: 0,
        results: {},
        error: (error as Error).message,
      };

      // Mark file as failed
      setBatchProgress((prev) => ({
        ...prev,
        [file.name]: { status: "failed", result },
      }));

      // Append failed result to logs
      let resultLogFileName = logFileName;
      if (logsDirectory) {
        const { logFileName: newFileName } = await LogWriter.appendFileResults(
          logsDirectory,
          logFileName,
          file.name,
          result
        );
        resultLogFileName = newFileName;
      }

      return { result, logFileName: resultLogFileName };
    }
  };

  /**
   * Process selected files in batches
   * @param {File[]} selectedFiles - Array of files to process
   * @param {Function} onStart - Callback when processing starts
   * @param {Function} onComplete - Callback when processing completes
   */
  const processBatch = async (
    selectedFiles: File[],
    onStart?: () => void,
    onComplete?: () => void
  ) => {
    if (selectedFiles.length === 0) {
      alert("No files selected");
      return;
    }

    // Check if logs directory is provided
    if (!logsDirectory) {
      alert("Logs directory is required for batch processing.");
      return;
    }

    setFiles(selectedFiles);
    setTotalFiles(selectedFiles.length);
    setProcessing(true);
    setResults([]);
    setCurrentFileIndex(0);
    setCurrentLogFileName(null);
    setBatchProgress({});
    setFilePageProgress({});

    // Notify that processing has started
    if (onStart) onStart();

    const processedResults: ProcessResult[] = [];
    let batchLogFileName: string | null = null;

    try {
      // Process files in batches
      for (let i = 0; i < selectedFiles.length; i += batchSize) {
        const batch = selectedFiles.slice(i, i + batchSize);

        // Set current batch for display
        setCurrentBatch(batch);
        setBatchProgress({});
        setFilePageProgress({});

        // Create ONE instance of PDFManager for this batch
        const pdfManager = createPDFManager();

        // Process batch in parallel with the same PDFManager instance
        const batchPromises = batch.map((file) =>
          processFileWithManager(file, pdfManager, batchLogFileName)
        );
        const batchResultsWithLogFile = await Promise.all(batchPromises);

        // Extract results and update log filename for next iteration
        const batchResults = batchResultsWithLogFile.map((item) => item.result);
        if (batchResultsWithLogFile.length > 0 && batchResultsWithLogFile[0].logFileName) {
          batchLogFileName = batchResultsWithLogFile[0].logFileName;
        }

        processedResults.push(...batchResults);
        setCurrentFileIndex(Math.min(i + batchSize, selectedFiles.length));
        setResults([...processedResults]);
        setCurrentLogFileName(batchLogFileName);
      }
    } catch (error) {
      console.error("Batch processing error:", error);
      alert("Error during batch processing: " + (error as Error).message);
    } finally {
      setProcessing(false);
      setCurrentBatch([]);
      setBatchProgress({});
      setFilePageProgress({});

      // Notify that processing has completed
      if (onComplete) onComplete();
    }
  };

  /**
   * Calculate summary statistics
   */
  const getSummary = () => {
    let totalPages = 0;
    let successCount = 0;
    let failedCount = 0;

    results.forEach((result) => {
      totalPages += result.totalPages || 0;
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    });

    return { totalPages, successCount, failedCount };
  };

  /**
   * Reset all state
   */
  const reset = () => {
    setFiles([]);
    setProcessing(false);
    setResults([]);
    setCurrentBatch([]);
    setBatchProgress({});
    setFilePageProgress({});
    setCurrentFileIndex(0);
    setTotalFiles(0);
    setCurrentLogFileName(null);
  };

  return {
    // State
    processing,
    results,
    currentBatch,
    batchProgress,
    filePageProgress,
    currentFileIndex,
    totalFiles,
    currentLogFileName,

    // Methods
    processBatch,
    getSummary,
    reset,
  };
};
