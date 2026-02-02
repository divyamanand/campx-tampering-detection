/**
 * PDF Routing Worker - Asynchronous File Movement
 *
 * Processes routing jobs via message passing:
 * - Listens for routing jobs from RoutingWorkerPool
 * - Creates folders lazily (serialized, no race conditions)
 * - Moves files atomically
 * - Sends results back to main process
 *
 * Pure Node.js worker (no Electron, no DOM)
 * Uses parentPort for message passing (not shared memory)
 */

import { parentPort } from 'worker_threads';
import { FileRoutingService } from '../services/FileRoutingService';
import type { FileStatus } from '../services/FileRoutingService';

interface RoutingJobRequest {
  fileName: string;
  sourcePath: string;
  baseDir: string;
  finalStatus: FileStatus;
}

interface RoutingResultMessage {
  type: 'result';
}

interface RoutingErrorMessage {
  type: 'error';
  error: string;
}

/**
 * Initialize routing service once (reused across all jobs)
 */
let routingService: FileRoutingService | null = null;

/**
 * Initialize worker
 */
function initializeWorker(): void {
  if (!routingService) {
    routingService = new FileRoutingService();
    console.log('[RoutingWorker] Initialized FileRoutingService');
  }
}

/**
 * Folder creation cache (to avoid redundant mkdir calls)
 */
const createdFolders = new Set<string>();

/**
 * Ensure folder exists (with caching to avoid redundant calls)
 */
async function ensureFolderExists(folderPath: string): Promise<void> {
  if (createdFolders.has(folderPath)) {
    // Already created in this session
    return;
  }

  try {
    await routingService!.ensureFolder(folderPath);
    createdFolders.add(folderPath);
    console.log(`[RoutingWorker] Folder ensured: ${folderPath}`);
  } catch (error) {
    console.error(`[RoutingWorker] Failed to ensure folder ${folderPath}:`, error);
    throw error;
  }
}

/**
 * Send result back to main process
 */
function sendResult(success: boolean, error?: string): void {
  if (!parentPort) return;

  const message: RoutingResultMessage | RoutingErrorMessage = error
    ? {
        type: 'error',
        error,
      }
    : {
        type: 'result',
      };

  parentPort.postMessage(message);
}

/**
 * Process a single routing job
 */
async function processRoutingJob(job: RoutingJobRequest): Promise<void> {
  if (!routingService) {
    throw new Error('RoutingService not initialized');
  }

  const { fileName, sourcePath, baseDir, finalStatus } = job;

  try {
    console.log(`[RoutingWorker] Processing: ${fileName} (${finalStatus})`);

    // Step 1: Get destination path
    const destinationPath = routingService.getDestinationPath(baseDir, fileName, finalStatus);
    const destinationFolder = destinationPath.substring(0, destinationPath.lastIndexOf('/'));

    // Step 2: Ensure destination folder exists
    await ensureFolderExists(destinationFolder);

    // Step 3: Move file atomically
    await routingService.moveFile(sourcePath, destinationPath);

    console.log(`[RoutingWorker] ✓ Moved: ${fileName} → ${finalStatus}/`);

    // Send success result
    sendResult(true);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[RoutingWorker] Failed to route ${fileName}:`, error);
    sendResult(false, errorMessage);
  }
}

/**
 * Listen for routing jobs from main process via message passing
 *
 * IMPORTANT: Unlike the broken previous design, this worker:
 * 1. Receives jobs via parentPort.on('message')
 * 2. Never tries to access main process memory (RoutingQueue)
 * 3. Processes one job at a time (serialized)
 * 4. Sends results back via parentPort.postMessage()
 */
if (parentPort) {
  // Initialize worker when first message arrives
  parentPort.on('message', async (job: RoutingJobRequest) => {
    if (job.fileName && job.sourcePath && job.baseDir && job.finalStatus) {
      // Initialize worker on first job
      if (!routingService) {
        initializeWorker();
      }

      // Process the job
      await processRoutingJob(job);
    } else {
      console.error('[RoutingWorker] Invalid job request:', job);
      sendResult(false, 'Invalid job format');
    }
  });

  console.log('[RoutingWorker] PDF routing worker ready (listening for jobs via parentPort)');
} else {
  console.error('[RoutingWorker] Not running in worker thread context');
  process.exit(1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[RoutingWorker] Uncaught exception:', error);
  if (parentPort) {
    parentPort.postMessage({
      type: 'error',
      error: error.message,
    });
  }
  process.exit(1);
});
