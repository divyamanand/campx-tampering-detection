/**
 * Worker Pool Configuration
 *
 * Dynamically calculates optimal worker pool size based on CPU count
 * Avoids oversubscription while maximizing parallelism
 */

import os from 'os';

/**
 * Calculate optimal worker pool size
 *
 * Rules:
 * - Never equal to total CPU count (leave headroom for main thread + system)
 * - 2-4 workers is ideal for Electron (CPU-heavy PDF + barcode scanning)
 * - Never less than 1 (always have at least one worker)
 *
 * Examples:
 * - 2 CPUs → 1 worker
 * - 4 CPUs → 3 workers
 * - 8 CPUs → 4 workers (capped)
 * - 16 CPUs → 4 workers (capped)
 */
export const WORKER_POOL_SIZE = Math.max(1, Math.min(4, os.cpus().length - 1));

/**
 * Worker pool configuration object
 */
export const WORKER_CONFIG = {
  /**
   * Number of concurrent workers
   * Dynamically calculated to avoid CPU oversubscription
   */
  poolSize: WORKER_POOL_SIZE,

  /**
   * Timeout for worker initialization (ms)
   * If a worker doesn't start responding within this time, it's considered failed
   */
  initTimeoutMs: 5000,

  /**
   * Timeout for individual scan jobs (ms)
   * If a job doesn't complete within this time, it's rejected
   * Large PDFs might exceed this, so keep generous
   */
  jobTimeoutMs: 300000, // 5 minutes

  /**
   * Maximum jobs to queue
   * Prevents memory exhaustion from unbounded queue
   */
  maxQueueSize: 1000,

  /**
   * Enable verbose logging for pool operations
   */
  verbose: process.env.NODE_ENV === 'development',
};

/**
 * Logging helper
 */
export function logPoolDebug(message: string, data?: unknown): void {
  if (WORKER_CONFIG.verbose) {
    console.log(`[WorkerPool] ${message}`, data || '');
  }
}

export function logPoolError(message: string, error?: unknown): void {
  console.error(`[WorkerPool] ${message}`, error || '');
}
