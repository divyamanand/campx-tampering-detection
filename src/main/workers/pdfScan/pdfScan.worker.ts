/**
 * PDF Scanning Worker
 *
 * Pure Node.js worker thread for CPU-intensive PDF scanning
 * - NO Electron imports
 * - NO DOM
 * - NO IPC
 *
 * Runs in worker thread context with access to parentPort
 */

import { parentPort } from 'worker_threads';
import { PDFManager } from '../../services/pdf/pdf-manager.service';
import { VerificationService } from '../../services/verification/verification.service';
import type { WorkerScanRequest, WorkerProgressEvent, WorkerResultEvent, WorkerErrorEvent } from './worker.types';
import type { VerificationResult } from '../../services/verification/verification.service';

/**
 * Initialize ZXing and services once (reused across multiple jobs)
 * This is the key optimization for the worker pool:
 * - PDFManager creation is expensive (loads libraries)
 * - Reusing across jobs avoids repeated initialization
 * - Worker stays alive indefinitely (never exits)
 */
let pdfManager: PDFManager | null = null;
let verificationService: VerificationService | null = null;

/**
 * Initialize the worker's PDFManager and VerificationService
 */
function initializeWorker(): void {
  if (!pdfManager) {
    // Import zxing setup if needed (already done at main process level)
    // PDFManager will use the already-initialized ZXing module
    pdfManager = new PDFManager();
    console.log('[Worker] Initialized PDFManager');
  }

  if (!verificationService) {
    verificationService = new VerificationService();
    console.log('[Worker] Initialized VerificationService');
  }
}

/**
 * Send progress event to main process
 */
function sendProgress(id: string, fileName: string, pageNumber: number, totalPages: number): void {
  if (!parentPort) return;

  const progressEvent: WorkerProgressEvent = {
    type: 'progress',
    id,
    fileName,
    pageNumber,
    totalPages,
  };

  parentPort.postMessage(progressEvent);
}

/**
 * Send result event to main process
 */
function sendResult(
  id: string,
  fileName: string,
  success: boolean,
  results: Record<number, unknown>,
  totalPages: number,
  verificationResult?: { status: 'scan_passed' | 'retry' | 'tampered'; reason?: string },
  error?: string
): void {
  if (!parentPort) return;

  const resultEvent: WorkerResultEvent = {
    type: 'result',
    id,
    fileName,
    success,
    results,
    totalPages,
    verificationResult,
    error,
  };

  parentPort.postMessage(resultEvent);
}

/**
 * Send error event to main process
 */
function sendError(id: string, fileName: string, error: string): void {
  if (!parentPort) return;

  const errorEvent: WorkerErrorEvent = {
    type: 'error',
    id,
    fileName,
    error,
  };

  parentPort.postMessage(errorEvent);
}

/**
 * Process a PDF scan request
 */
async function processScan(request: WorkerScanRequest): Promise<void> {
  const { id, buffer, fileName, config } = request;

  try {
    // Ensure worker is initialized
    initializeWorker();

    if (!pdfManager || !verificationService) {
      throw new Error('Worker services failed to initialize');
    }

    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);

    console.log(`[Worker] Starting scan: ${fileName}`);

    // Create callback for progress updates
    const onPageComplete = (data: {
      fileName: string;
      pageNumber: number;
      totalPages: number;
      pageResult: unknown;
    }) => {
      sendProgress(id, data.fileName, data.pageNumber, data.totalPages);
    };

    // Process the PDF
    const scanResult = await pdfManager.processBuffer(
      uint8Array,
      fileName,
      onPageComplete
    );

    console.log(`[Worker] Scan complete: ${fileName}`);

    // Run verification on the scanned results
    let verificationResult: { status: 'scan_passed' | 'retry' | 'tampered'; reason?: string } | undefined;

    if (scanResult.success) {
      try {
        const verificationContext = {
          fileName,
          filePath: '', // Will be set by main process
          totalPages: scanResult.totalPages,
          pageResults: scanResult.results as Record<number, unknown>,
          config,
        };

        const verification = verificationService.verify(verificationContext as any);
        verificationResult = {
          status: verification.status,
          reason: 'reason' in verification ? verification.reason : undefined,
        };

        console.log(`[Worker] Verification complete: ${fileName} → ${verification.status}`);
      } catch (verifyError) {
        console.error(`[Worker] Verification error for ${fileName}:`, verifyError);
        // Continue anyway - don't fail the whole job due to verification error
      }
    }

    // Send final result with verification
    sendResult(
      id,
      scanResult.fileName,
      scanResult.success,
      scanResult.results,
      scanResult.totalPages,
      verificationResult,
      scanResult.error
    );
  } catch (error) {
    console.error(`[Worker] Error scanning ${fileName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendError(id, fileName, errorMessage);
  }
}

/**
 * Listen for scan requests from main process
 *
 * IMPORTANT: This worker is designed to:
 * 1. Process multiple jobs over time (FIFO from queue)
 * 2. Never call process.exit() (stays alive indefinitely)
 * 3. Reuse PDFManager across jobs (expensive to initialize)
 * 4. Handle errors gracefully without crashing
 *
 * The WorkerPool manages:
 * - Queuing when worker is busy
 * - Assigning next job when this one completes
 * - Respawning if worker crashes
 */
if (parentPort) {
  parentPort.on('message', async (request: WorkerScanRequest) => {
    if (request.id && request.buffer && request.fileName) {
      await processScan(request);
    } else {
      console.error('[Worker] Invalid request received:', request);
      if (request.id) {
        const errorEvent: WorkerErrorEvent = {
          type: 'error',
          id: request.id,
          fileName: request.fileName || 'unknown',
          error: 'Invalid request format',
        };
        parentPort!.postMessage(errorEvent);
      }
    }
  });

  console.log('[Worker] PDF scanning worker ready (will handle multiple jobs)');
} else {
  console.error('[Worker] Not running in worker thread context');
  // Don't exit - allow parent to handle lifecycle
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Worker] Uncaught exception:', error);
  if (parentPort) {
    parentPort.postMessage({
      type: 'error',
      error: error.message,
    });
  }
});
