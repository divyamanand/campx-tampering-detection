/**
 * Routing Worker Pool - Manages the file routing worker thread
 *
 * Simplified version of WorkerPool for routing operations:
 * - Single persistent worker (file operations are I/O-bound, not CPU-bound)
 * - Processes routing jobs from RoutingQueue
 * - Serialized file movements (no race conditions)
 *
 * Unlike PDF scanning (parallel workers), routing uses ONE worker
 * to ensure atomic, serialized file operations.
 */

import { Worker } from 'worker_threads';
import path from 'path';

/**
 * Routing Worker Pool - Manages single routing worker
 */
export class RoutingWorkerPool {
  /**
   * Single routing worker instance
   */
  private worker: Worker | null = null;

  /**
   * Initialize the routing worker
   */
  initialize(): void {
    if (this.worker) {
      console.log('[RoutingWorkerPool] Worker already initialized');
      return;
    }

    try {
      const workerPath = path.join(__dirname, 'pdfRouting.worker.js');
      this.worker = new Worker(workerPath);

      this.worker.on('error', (error) => {
        console.error('[RoutingWorkerPool] Worker error:', error);
      });

      this.worker.on('exit', (code) => {
        console.log(`[RoutingWorkerPool] Worker exited with code ${code}`);
        this.worker = null;
      });

      console.log('[RoutingWorkerPool] Routing worker initialized');
    } catch (error) {
      console.error('[RoutingWorkerPool] Failed to initialize worker:', error);
      throw error;
    }
  }

  /**
   * Terminate the routing worker gracefully
   */
  terminate(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.worker) {
        resolve(0);
        return;
      }

      this.worker.terminate().then((code) => {
        console.log('[RoutingWorkerPool] Worker terminated');
        this.worker = null;
        resolve(code);
      });
    });
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.worker !== null;
  }

  /**
   * Get worker instance (for internal use only)
   */
  getWorker(): Worker | null {
    return this.worker;
  }
}

/**
 * Global routing worker pool instance
 */
let routingWorkerPool: RoutingWorkerPool | null = null;

/**
 * Initialize and get routing worker pool singleton
 */
export function initializeRoutingWorkerPool(): RoutingWorkerPool {
  if (!routingWorkerPool) {
    routingWorkerPool = new RoutingWorkerPool();
    routingWorkerPool.initialize();
  }
  return routingWorkerPool;
}

/**
 * Get existing routing worker pool
 */
export function getRoutingWorkerPool(): RoutingWorkerPool {
  if (!routingWorkerPool) {
    throw new Error('Routing worker pool not initialized. Call initializeRoutingWorkerPool() first.');
  }
  return routingWorkerPool;
}
