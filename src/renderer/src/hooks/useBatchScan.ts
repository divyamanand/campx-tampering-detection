import { useState, useCallback, useEffect } from 'react';
import { scannerService } from '../services/ScannerService';
import type { BatchState, BatchProgressEvent } from '../../../main/types/batchSettings.types';
import type { BatchSettings } from '../../../main/types/batchSettings.types';

interface UseBatchScanReturn {
  scanning: boolean;
  paused: boolean;
  batchState: BatchState | null;
  batchProgress: BatchProgressEvent | null;
  error: string | null;

  // Control methods
  startBatch: (settings: BatchSettings) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

/**
 * useBatchScan - Hook for batch directory scanning with verification & routing
 *
 * Uses the complete BatchOrchestrator pipeline:
 * - PDF scanning workers (pdfScan.worker.ts)
 * - Verification service (inside workers)
 * - Routing queue → routing worker (pdfRouting.worker.ts)
 * - Crash-safe batch logging (BatchLogger)
 *
 * Supports: start, pause, resume, stop operations
 */
export const useBatchScan = (): UseBatchScanReturn => {
  const [scanning, setScanning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [batchState, setBatchState] = useState<BatchState | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set up listener for batch progress events from main process
  useEffect(() => {
    const handleBatchProgress = (progressData: unknown) => {
      const progress = progressData as BatchProgressEvent;
      setBatchProgress(progress);

      // Update scanning state based on progress type
      if (progress.type === 'batch-complete' || progress.type === 'batch-error') {
        setScanning(false);
        setPaused(false);
      }
    };

    scannerService.onBatchProgress(handleBatchProgress);

    return () => {
      // Note: The current IPC setup doesn't provide an 'off' method
      // This is a limitation that could be improved in future
    };
  }, []);

  const startBatch = useCallback(
    async (settings: BatchSettings): Promise<void> => {
      setScanning(true);
      setPaused(false);
      setError(null);
      setBatchState(null);
      setBatchProgress(null);

      try {
        const response = await scannerService.startBatch(settings);

        if (!response.success) {
          setError(response.error || 'Failed to start batch');
          setScanning(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setScanning(false);
      }
    },
    []
  );

  const pause = useCallback(async (): Promise<void> => {
    try {
      const response = await scannerService.pauseBatch();

      if (response.success) {
        setPaused(true);
      } else {
        setError(response.error || 'Failed to pause batch');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  }, []);

  const resume = useCallback(async (): Promise<void> => {
    try {
      const response = await scannerService.resumeBatch();

      if (response.success) {
        setPaused(false);
      } else {
        setError(response.error || 'Failed to resume batch');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    try {
      const response = await scannerService.stopBatch();

      if (response.success) {
        setScanning(false);
        setPaused(false);
      } else {
        setError(response.error || 'Failed to stop batch');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  }, []);

  const reset = useCallback(() => {
    setScanning(false);
    setPaused(false);
    setBatchState(null);
    setBatchProgress(null);
    setError(null);
  }, []);

  return {
    scanning,
    paused,
    batchState,
    batchProgress,
    error,
    startBatch,
    pause,
    resume,
    stop,
    reset,
  };
};
