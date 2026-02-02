/**
 * PDF Routing Worker - Asynchronous File Movement
 *
 * Processes routing jobs:
 * - Picks up routing jobs from RoutingQueue
 * - Creates folders lazily (serialized, no race conditions)
 * - Moves files atomically
 * - Never blocks scanning
 *
 * Pure Node.js worker (no Electron, no DOM, no IPC)
 */

import { parentPort } from 'worker_threads';
import { FileRoutingService } from '../services/FileRoutingService';
import { getRoutingQueue } from '../services/RoutingQueue';
import type { RoutingJob } from '../services/RoutingQueue';

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
 * Process a single routing job
 */
async function processRoutingJob(job: RoutingJob): Promise<void> {
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
  } catch (error) {
    console.error(`[RoutingWorker] Failed to route ${fileName}:`, error);
    throw error;
  }
}

/**
 * Main routing loop - picks up jobs and processes them
 * Runs indefinitely until worker is terminated
 */
async function routingLoop(): Promise<void> {
  const queue = getRoutingQueue();

  console.log('[RoutingWorker] Routing loop started');

  while (true) {
    try {
      // Wait for next job
      const job = await queue.dequeue();

      if (!job) {
        // Queue was cleared or worker shutting down
        console.log('[RoutingWorker] No more jobs');
        break;
      }

      // Process the job
      await processRoutingJob(job);
    } catch (error) {
      console.error('[RoutingWorker] Error processing job:', error);
      // Continue processing next job even if one fails
    }
  }
}

/**
 * Start the routing worker
 */
function startRoutingWorker(): void {
  initializeWorker();

  // Start the routing loop (never exits)
  routingLoop().catch((error) => {
    console.error('[RoutingWorker] Routing loop crashed:', error);
    process.exit(1);
  });

  console.log('[RoutingWorker] PDF routing worker ready');
}

// Start the worker
startRoutingWorker();

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[RoutingWorker] Uncaught exception:', error);
  process.exit(1);
});
