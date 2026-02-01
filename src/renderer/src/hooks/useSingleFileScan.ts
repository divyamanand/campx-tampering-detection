import { useState, useCallback } from 'react';

interface ScanResult {
  fileName: string;
  totalPages: number;
  results: Record<string, unknown>;
  success: boolean;
  error?: string;
}

interface UseSingleFileScanReturn {
  scanning: boolean;
  result: ScanResult | null;
  error: string | null;
  scanFile: (filePath: string, config?: Record<string, unknown>) => Promise<ScanResult | null>;
  reset: () => void;
}

/**
 * useSingleFileScan - Custom hook for scanning a single PDF file
 *
 * Invokes the 'scan-pdf-file' IPC handler on the main process
 *
 * @returns {UseSingleFileScanReturn} Scan state and methods
 */
export const useSingleFileScan = (): UseSingleFileScanReturn => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scanFile = useCallback(
    async (filePath: string, config: Record<string, unknown> = {}): Promise<ScanResult | null> => {
      setScanning(true);
      setError(null);

      try {
        const scanResult = await window.electronAPI.invoke('scan-pdf-file', filePath, config);

        if (scanResult && !scanResult.success) {
          const errorMessage = scanResult.error || 'Failed to scan file';
          setError(errorMessage);
          setResult(scanResult);
          return scanResult;
        }

        setResult(scanResult);
        return scanResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during scanning';
        setError(errorMessage);
        setResult(null);
        return null;
      } finally {
        setScanning(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setScanning(false);
    setResult(null);
    setError(null);
  }, []);

  return {
    scanning,
    result,
    error,
    scanFile,
    reset,
  };
};
