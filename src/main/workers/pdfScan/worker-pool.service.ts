/**
 * Worker Pool - Manages PDF scanning workers
 *
 * Responsibilities:
 * - Spawn and manage worker threads
 * - Track idle/busy state
 * - Queue jobs when all workers are busy
 * - Auto-assign jobs when workers become idle
 * - Handle worker crashes and recovery
 * - Route messages to correct promise resolvers
 */

import { Worker } from 'worker_threads';
import path from 'path';
import { WORKER_POOL_SIZE, WORKER_CONFIG, logPoolDebug, logPoolError } from '../../config/worker.config';
import type { WorkerJob, WorkerState, PoolStats, WorkerMessage } from './worker.types';

/**
 * WorkerPool - Manages a pool of worker threads
 */
export class WorkerPool {
  /**
   * Pool of worker threads with their state
   */
  private workers: WorkerState[] = [];

  /**
   * Queue of jobs waiting for an idle worker
   */
  private queue: WorkerJob[] = [];

  /**
   * Map of job ID to the job itself (for message routing)
   */
  private jobMap: Map<string, WorkerJob> = new Map();

  /**
   * Path to the compiled worker file
   */
  private workerPath: string;

  /**
   * Whether the pool has been terminated
   */
  private terminated = false;

  /**
   * Statistics tracking
   */
  private stats = {
    totalJobsProcessed: 0,
    totalProcessingTime: 0,
  };

  constructor() {
    this.workerPath = path.join(__dirname, './pdfScan.worker.js');
    logPoolDebug(`Pool config: size=${WORKER_POOL_SIZE}, maxQueue=${WORKER_CONFIG.maxQueueSize}`);
  }

  /**
   * Initialize the worker pool
   * Creates all worker threads upfront
   */
  async initialize(): Promise<void> {
    if (this.workers.length > 0) {
      logPoolDebug('Pool already initialized');
      return;
    }

    logPoolDebug(`Initializing worker pool with ${WORKER_POOL_SIZE} workers`);

    for (let i = 0; i < WORKER_POOL_SIZE; i++) {
      try {
        const worker = new Worker(this.workerPath);
        const state: WorkerState = {
          worker,
          busy: false,
          createdAt: Date.now(),
          jobsCompleted: 0,
          totalProcessingTime: 0,
        };

        // Handle worker messages
        worker.on('message', (message: WorkerMessage) => {
          this.handleWorkerMessage(state, message);
        });

        // Handle worker errors
        worker.on('error', (error: Error) => {
          logPoolError(`Worker ${i} error:`, error);
          this.handleWorkerError(state);
        });

        // Handle worker exit
        worker.on('exit', (code) => {
          logPoolDebug(`Worker ${i} exited with code ${code}`);
          this.handleWorkerExit(state, code);
        });

        this.workers.push(state);
        logPoolDebug(`Worker ${i} initialized`);
      } catch (error) {
        logPoolError(`Failed to initialize worker ${i}:`, error);
        throw error;
      }
    }

    logPoolDebug(`✓ Worker pool initialized with ${this.workers.length} workers`);
  }

  /**
   * Submit a job to the pool
   * Returns a promise that resolves when the job completes
   */
  async submit(job: WorkerJob): Promise<any> {
    if (this.terminated) {
      throw new Error('Worker pool has been terminated');
    }

    if (this.queue.length >= WORKER_CONFIG.maxQueueSize) {
      throw new Error(`Job queue is full (${WORKER_CONFIG.maxQueueSize} jobs)`);
    }

    // Initialize pool if needed
    if (this.workers.length === 0) {
      await this.initialize();
    }

    // Mark creation time
    job.createdAt = Date.now();

    // Store job for message routing
    this.jobMap.set(job.id, job);

    logPoolDebug(`Job submitted: ${job.fileName} (${job.id})`);

    // Try to assign immediately, else queue it
    const assigned = this.tryAssignJob(job);
    if (!assigned) {
      logPoolDebug(`Job queued: ${job.fileName} (queue size: ${this.queue.length})`);
      this.queue.push(job);
    }

    // Return promise that will be resolved when job completes
    return new Promise((resolve, reject) => {
      // Override the resolve/reject with wrappers that update stats
      const originalResolve = job.resolve;
      const originalReject = job.reject;

      job.resolve = (value: any) => {
        const duration = Date.now() - (job.assignedAt || job.createdAt!);
        this.stats.totalJobsProcessed++;
        this.stats.totalProcessingTime += duration;
        logPoolDebug(`Job completed: ${job.fileName} (${duration}ms)`);
        originalResolve(value);
        resolve(value);
      };

      job.reject = (error: Error) => {
        const duration = Date.now() - (job.assignedAt || job.createdAt!);
        logPoolError(`Job failed: ${job.fileName}`, error.message);
        originalReject(error);
        reject(error);
      };
    });
  }

  /**
   * Try to assign a job to an idle worker
   * Returns true if assigned, false if no idle worker available
   */
  private tryAssignJob(job: WorkerJob): boolean {
    const idleWorker = this.workers.find((state) => !state.busy);
    if (!idleWorker) {
      return false;
    }

    this.assignJobToWorker(idleWorker, job);
    return true;
  }

  /**
   * Assign a job to a specific worker
   */
  private assignJobToWorker(state: WorkerState, job: WorkerJob): void {
    state.busy = true;
    state.currentJob = job;
    job.assignedAt = Date.now();

    logPoolDebug(`Assigning job to worker: ${job.fileName}`);

    try {
      // Send job to worker (transfer buffer ownership)
      state.worker.postMessage(
        {
          id: job.id,
          buffer: job.buffer,
          fileName: job.fileName,
          config: job.config,
        },
        [job.buffer] // Transfer ArrayBuffer, not copy
      );
    } catch (error) {
      logPoolError('Failed to send job to worker:', error);
      state.busy = false;
      state.currentJob = undefined;
      job.reject(error instanceof Error ? error : new Error('Failed to send job to worker'));
      this.jobMap.delete(job.id);
    }
  }

  /**
   * Handle messages from worker threads
   */
  private handleWorkerMessage(state: WorkerState, message: WorkerMessage): void {
    const { type, id } = message as any;

    if (!id) {
      logPoolError('Received message without ID:', message);
      return;
    }

    const job = this.jobMap.get(id);
    if (!job) {
      logPoolError(`Received message for unknown job ID: ${id}`);
      return;
    }

    if (type === 'progress') {
      // Forward progress event
      if (job.onProgress) {
        const progressMsg = message as any;
        job.onProgress({
          fileName: progressMsg.fileName,
          pageNumber: progressMsg.pageNumber,
          totalPages: progressMsg.totalPages,
        });
      }
    } else if (type === 'result') {
      // Job completed
      const resultMsg = message as any;
      job.resolve({
        fileName: resultMsg.fileName,
        totalPages: resultMsg.totalPages,
        results: resultMsg.results,
        success: resultMsg.success,
        error: resultMsg.error,
      });

      // Clean up
      this.jobMap.delete(id);
      state.jobsCompleted++;
      state.totalProcessingTime += Date.now() - (job.assignedAt || job.createdAt!);

      // Worker is now idle
      this.releaseWorker(state);
    } else if (type === 'error') {
      // Job failed
      const errorMsg = message as any;
      job.reject(new Error(`${errorMsg.fileName}: ${errorMsg.error}`));

      // Clean up
      this.jobMap.delete(id);

      // Worker is now idle
      this.releaseWorker(state);
    }
  }

  /**
   * Release a worker (mark as idle and try to assign queued job)
   */
  private releaseWorker(state: WorkerState): void {
    state.busy = false;
    state.currentJob = undefined;

    // Try to assign next job from queue
    if (this.queue.length > 0) {
      const nextJob = this.queue.shift();
      if (nextJob) {
        logPoolDebug(`Dequeuing job: ${nextJob.fileName} (queue size: ${this.queue.length})`);
        this.assignJobToWorker(state, nextJob);
      }
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(state: WorkerState): void {
    const currentJob = state.currentJob;

    // Reject current job if any
    if (currentJob) {
      currentJob.reject(new Error('Worker encountered an error'));
      this.jobMap.delete(currentJob.id);
    }

    // Mark worker as unavailable (don't reuse)
    state.busy = false;
    const index = this.workers.indexOf(state);
    if (index >= 0) {
      this.workers.splice(index, 1);
    }

    // Try to respawn worker if pool not terminated
    if (!this.terminated && this.workers.length < WORKER_POOL_SIZE) {
      logPoolDebug('Respawning worker...');
      // Note: Respawning is deferred to maintain stability
      setImmediate(() => this.respawnWorker());
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(state: WorkerState, code: number): void {
    if (code !== 0) {
      logPoolError(`Worker exited with non-zero code: ${code}`);
      this.handleWorkerError(state);
    } else {
      // Normal exit, just remove from pool
      const index = this.workers.indexOf(state);
      if (index >= 0) {
        this.workers.splice(index, 1);
      }
    }
  }

  /**
   * Respawn a failed worker
   */
  private async respawnWorker(): Promise<void> {
    if (this.terminated) {
      return;
    }

    try {
      const worker = new Worker(this.workerPath);
      const state: WorkerState = {
        worker,
        busy: false,
        createdAt: Date.now(),
        jobsCompleted: 0,
        totalProcessingTime: 0,
      };

      worker.on('message', (message: WorkerMessage) => {
        this.handleWorkerMessage(state, message);
      });

      worker.on('error', (error: Error) => {
        logPoolError('Respawned worker error:', error);
        this.handleWorkerError(state);
      });

      worker.on('exit', (code) => {
        logPoolDebug(`Respawned worker exited with code ${code}`);
        this.handleWorkerExit(state, code);
      });

      this.workers.push(state);
      logPoolDebug(`✓ Worker respawned, pool size now ${this.workers.length}`);
    } catch (error) {
      logPoolError('Failed to respawn worker:', error);
    }
  }

  /**
   * Get current pool statistics
   */
  getStats(): PoolStats {
    const busyCount = this.workers.filter((s) => s.busy).length;
    const idleCount = this.workers.length - busyCount;

    return {
      totalWorkers: this.workers.length,
      busyWorkers: busyCount,
      idleWorkers: idleCount,
      queuedJobs: this.queue.length,
      totalJobsProcessed: this.stats.totalJobsProcessed,
      averageJobTime:
        this.stats.totalJobsProcessed > 0
          ? Math.round(this.stats.totalProcessingTime / this.stats.totalJobsProcessed)
          : 0,
    };
  }

  /**
   * Wait for all jobs to complete (for graceful shutdown)
   */
  async drain(): Promise<void> {
    while (this.queue.length > 0 || this.workers.some((s) => s.busy)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Terminate the worker pool
   */
  async terminate(): Promise<void> {
    logPoolDebug('Terminating worker pool...');
    this.terminated = true;

    // Wait for all jobs to complete
    await this.drain();

    // Terminate all workers
    for (const state of this.workers) {
      try {
        await state.worker.terminate();
      } catch (error) {
        logPoolError('Error terminating worker:', error);
      }
    }

    this.workers = [];
    this.queue = [];
    this.jobMap.clear();

    logPoolDebug('✓ Worker pool terminated');
  }
}

/**
 * Singleton instance
 */
let poolInstance: WorkerPool | null = null;

/**
 * Get or create the worker pool singleton
 */
export function getWorkerPool(): WorkerPool {
  if (!poolInstance) {
    poolInstance = new WorkerPool();
  }
  return poolInstance;
}

/**
 * Terminate the worker pool singleton
 */
export async function terminateWorkerPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.terminate();
    poolInstance = null;
  }
}
