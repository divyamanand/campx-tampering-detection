/**
 * Routing Worker Pool - Manages the file routing worker thread
 *
 * Simplified version of WorkerPool for routing operations:
 * - Single persistent worker (file operations are I/O-bound, not CPU-bound)
 * - Queues routing jobs locally (not shared with worker)
 * - Uses message passing for serialized file movements
 * - No race conditions (serialized via single worker)
 *
 * Unlike PDF scanning (parallel workers), routing uses ONE worker
 * to ensure atomic, serialized file operations.
 */

import { Worker } from 'worker_threads';
import path from 'path';
import type { FileStatus } from '../../services/file-operations/file-routing.service';
import type { RoutingJob, RoutingJobWithResolver, RoutingMessage } from './routing.types';

/**
 * Routing Worker Pool - Manages single routing worker with local queue
 */
export class RoutingWorkerPool {
  /**
   * Single routing worker instance
   */
  private worker: Worker | null = null;

  /**
   * Queue of jobs waiting to be processed (local queue, not shared with worker)
   */
  private queue: RoutingJobWithResolver[] = [];

  /**
   * Current job being processed
   */
  private currentJob: RoutingJobWithResolver | null = null;

  /**
   * Initialize the routing worker
   */
  initialize(): void {
    if (this.worker) {
      return;
    }

    try {
      const workerPath = path.join(__dirname, './pdfRouting.worker.js');
      this.worker = new Worker(workerPath);

      // Listen for messages from worker
      this.worker.on('message', (message: RoutingMessage) => {
        this.handleWorkerMessage(message);
      });

      this.worker.on('error', (error: Error) => {
        console.error('[RoutingWorkerPool] Worker error:', error);
        if (this.currentJob) {
          this.currentJob.reject(error);
          this.currentJob = null;
        }
        this.processNextJob();
      });

      this.worker.on('exit', (code) => {
        this.worker = null;
        if (this.currentJob) {
          this.currentJob.reject(new Error('Worker exited unexpectedly'));
          this.currentJob = null;
        }
      });

    } catch (error) {
      console.error('[RoutingWorkerPool] Failed to initialize worker:', error);
      throw error;
    }
  }

  /**
   * Submit a routing job to the worker
   * Returns a promise that resolves when the job completes
   */
  async submit(job: RoutingJob): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const jobWithResolver: RoutingJobWithResolver = {
        ...job,
        resolve,
        reject,
      };

      // Add to queue
      this.queue.push(jobWithResolver);

      // Try to process if worker is idle
      this.processNextJob();
    });
  }

  /**
   * Process next job in queue if worker is idle
   */
  private processNextJob(): void {
    // Don't process if worker is busy or not available
    if (this.currentJob || !this.worker || this.queue.length === 0) {
      return;
    }

    // Get next job from queue
    const job = this.queue.shift();
    if (!job) {
      return;
    }

    this.currentJob = job;

    try {
      // Send job to worker (transfer ArrayBuffer if applicable)
      this.worker.postMessage({
        fileName: job.fileName,
        sourcePath: job.sourcePath,
        baseDir: job.baseDir,
        finalStatus: job.finalStatus,
      });
    } catch (error) {
      console.error('[RoutingWorkerPool] Failed to send job to worker:', error);
      if (this.currentJob) {
        this.currentJob.reject(error instanceof Error ? error : new Error(String(error)));
        this.currentJob = null;
      }
      this.processNextJob();
    }
  }

  /**
   * Handle messages from worker
   */
  private handleWorkerMessage(message: RoutingMessage): void {
    if (!this.currentJob) {
      console.warn('[RoutingWorkerPool] Received message but no current job:', message);
      return;
    }

    const { type, error } = message as any;

    if (type === 'result') {
      if (error) {
        console.error(`[RoutingWorkerPool] Job failed: ${this.currentJob.fileName}`, error);
        this.currentJob.reject(new Error(error));
      } else {
        this.currentJob.resolve({ success: true });
      }
    } else if (type === 'error') {
      console.error(`[RoutingWorkerPool] Worker error for ${this.currentJob.fileName}:`, error);
      this.currentJob.reject(new Error(error));
    }

    // Move to next job
    this.currentJob = null;
    this.processNextJob();
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
        this.worker = null;
        this.currentJob = null;
        this.queue = [];
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
   * Get queue size (for monitoring)
   */
  getQueueSize(): number {
    return this.queue.length + (this.currentJob ? 1 : 0);
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
