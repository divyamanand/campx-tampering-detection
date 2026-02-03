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
      try {
        const progress = progressData as BatchProgressEvent;

        // Validate progress event has required fields
        if (!progress.type) {
          console.error('Invalid progress event: missing type', progress);
          return;
        }

        setBatchProgress(progress);

        // Update scanning state based on progress type
        if (progress.type === 'batch-complete') {
          setScanning(false);
          setPaused(false);
        } else if (progress.type === 'batch-error') {
          setScanning(false);
          setPaused(false);
          setError(progress.error || 'Batch processing failed');
          console.error('[Progress Emitter] Batch error:', progress.error);
        }
      } catch (err) {
        console.error('[Progress Emitter] Failed to process progress event:', err);
      }
    };

    scannerService.onBatchProgress(handleBatchProgress);

    return () => {
      // Note: The current IPC setup doesn't provide an 'off' method
      // This is a limitation that could be improved in future
    };
  }, []);

  // Poll batch state to complement progress events
  useEffect(() => {
    if (!scanning) {
      // Clear state when not scanning
      setBatchState(null);
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await scannerService.getBatchState();
        if (response.success && response.result) {
          setBatchState(response.result);
        } else if (!response.success) {
          console.warn('[Batch State Poll] Failed to get batch state:', response.error);
        }
      } catch (err) {
        console.error('[Batch State Poll] Error fetching batch state:', err);
      }
    }, 1000); // Poll every 1 second during scanning

    // Initial poll on mount
    (async () => {
      try {
        const response = await scannerService.getBatchState();
        if (response.success && response.result) {
          setBatchState(response.result);
        }
      } catch (err) {
        console.error('[Batch State Poll] Initial poll failed:', err);
      }
    })();

    return () => clearInterval(pollInterval);
  }, [scanning]);

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
          const errorMsg = response.error || 'Failed to start batch';
          setError(errorMsg);
          setScanning(false);
          console.error('[useBatchScan] Start batch failed:', errorMsg);
        } else {

          // Fetch initial batch state after successful start
          try {
            const stateResponse = await scannerService.getBatchState();
            if (stateResponse.success && stateResponse.result) {
              setBatchState(stateResponse.result);
            }
          } catch (err) {
            console.error('[useBatchScan] Failed to fetch initial batch state:', err);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setScanning(false);
        console.error('[useBatchScan] Start batch exception:', errorMessage);
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
        const errorMsg = response.error || 'Failed to pause batch';
        setError(errorMsg);
        console.error('[useBatchScan] Pause failed:', errorMsg);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useBatchScan] Pause exception:', errorMessage);
    }
  }, []);

  const resume = useCallback(async (): Promise<void> => {

    try {
      const response = await scannerService.resumeBatch();

      if (response.success) {
        setPaused(false);
      } else {
        const errorMsg = response.error || 'Failed to resume batch';
        setError(errorMsg);
        console.error('[useBatchScan] Resume failed:', errorMsg);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useBatchScan] Resume exception:', errorMessage);
    }
  }, []);

  const stop = useCallback(async (): Promise<void> => {

    try {
      const response = await scannerService.stopBatch();

      if (response.success) {
        setScanning(false);
        setPaused(false);
      } else {
        const errorMsg = response.error || 'Failed to stop batch';
        setError(errorMsg);
        console.error('[useBatchScan] Stop failed:', errorMsg);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useBatchScan] Stop exception:', errorMessage);
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
