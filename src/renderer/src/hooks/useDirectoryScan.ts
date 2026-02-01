import { useState, useCallback, useEffect } from 'react';

interface ScanResult {
  fileName: string;
  totalPages: number;
  results: Record<string, unknown>;
  success: boolean;
  error?: string;
}

interface DirectoryScanProgress {
  filePath: string;
  fileName: string;
  pageNumber: number;
  totalPages: number;
}

interface UseDirectoryScanReturn {
  scanning: boolean;
  results: Record<string, ScanResult>;
  scanProgress: DirectoryScanProgress | null;
  scannedCount: number;
  failedCount: number;
  error: string | null;
  scanDirectory: (dirPath: string, config?: Record<string, unknown>) => Promise<void>;
  reset: () => void;
}

/**
 * useDirectoryScan - Custom hook for scanning all PDF files in a directory
 *
 * Invokes the 'scan-directory' IPC handler on the main process
 * Listens for 'scan-progress' events to track real-time progress
 *
 * @returns {UseDirectoryScanReturn} Scan state and methods
 */
export const useDirectoryScan = (): UseDirectoryScanReturn => {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<Record<string, ScanResult>>({});
  const [scanProgress, setScanProgress] = useState<DirectoryScanProgress | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Set up listener for progress events from main process
  useEffect(() => {
    const handleScanProgress = (progressData: DirectoryScanProgress) => {
      setScanProgress(progressData);
    };

    window.electronAPI.on('scan-progress', handleScanProgress);

    return () => {
      // Note: The preload script doesn't provide an 'off' method, so we can't unsubscribe
      // This is a limitation of the current IPC setup
    };
  }, []);

  const scanDirectory = useCallback(
    async (dirPath: string, config: Record<string, unknown> = {}): Promise<void> => {
      setScanning(true);
      setError(null);
      setResults({});
      setScannedCount(0);
      setFailedCount(0);
      setScanProgress(null);

      try {
        const directoryResults = await window.electronAPI.invoke('scan-directory', dirPath, config);

        if (directoryResults) {
          setResults(directoryResults.results || {});
          setScannedCount(directoryResults.scannedCount || 0);
          setFailedCount(directoryResults.failedCount || 0);

          if (directoryResults.failedCount > 0) {
            const failedFiles = directoryResults.failedFiles?.join(', ') || 'Unknown files';
            console.warn(`Failed to scan files: ${failedFiles}`);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during directory scan';
        setError(errorMessage);
      } finally {
        setScanning(false);
        setScanProgress(null);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setScanning(false);
    setResults({});
    setScannedCount(0);
    setFailedCount(0);
    setError(null);
    setScanProgress(null);
  }, []);

  return {
    scanning,
    results,
    scanProgress,
    scannedCount,
    failedCount,
    error,
    scanDirectory,
    reset,
  };
};
