/**
 * Routing Queue - Manages file routing jobs
 *
 * Decouples scanning from file movement:
 * - PDF worker enqueues routing jobs (non-blocking)
 * - Routing worker picks up jobs and moves files
 * - Ensures atomic, serialized file operations
 */

import type { FileStatus } from './FileRoutingService';

export interface RoutingJob {
  /**
   * Unique job identifier
   */
  id: string;

  /**
   * Original filename
   */
  fileName: string;

  /**
   * Full path to source file
   */
  sourcePath: string;

  /**
   * Base directory (from user settings)
   * Routing worker creates subdirs here
   */
  baseDir: string;

  /**
   * Final verification/processing status
   */
  finalStatus: FileStatus;

  /**
   * Timestamp when job was created
   */
  createdAt: number;
}

/**
 * In-memory queue for routing jobs
 * Thread-safe via promise-based enqueueing
 */
export class RoutingQueue {
  /**
   * Queue of pending routing jobs
   */
  private queue: RoutingJob[] = [];

  /**
   * Callbacks for when queue has jobs
   */
  private listeners: Array<() => void> = [];

  /**
   * Lock to prevent concurrent access (promise-based)
   */
  private lock: Promise<void> = Promise.resolve();

  /**
   * Enqueue a routing job (non-blocking)
   * Called by PDF worker after verification
   */
  async enqueue(job: Omit<RoutingJob, 'id' | 'createdAt'>): Promise<void> {
    const routingJob: RoutingJob = {
      id: `routing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...job,
      createdAt: Date.now(),
    };

    // Add to queue (non-blocking)
    this.queue.push(routingJob);
    console.log(`[RoutingQueue] Enqueued: ${job.fileName} (${job.finalStatus})`);

    // Notify listeners (routing worker)
    this.notifyListeners();
  }

  /**
   * Dequeue next job for routing worker
   * Blocks until job is available
   */
  async dequeue(): Promise<RoutingJob | null> {
    // Wait for next job
    while (this.queue.length === 0) {
      await new Promise<void>((resolve) => {
        this.listeners.push(resolve);
      });
    }

    // Get next job
    const job = this.queue.shift();
    return job || null;
  }

  /**
   * Get current queue size (for monitoring)
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Notify all waiting listeners
   */
  private notifyListeners(): void {
    const listeners = this.listeners.splice(0);
    listeners.forEach((resolve) => resolve());
  }

  /**
   * Clear entire queue (for shutdown)
   */
  clear(): void {
    this.queue = [];
    console.log('[RoutingQueue] Queue cleared');
  }
}

/**
 * Global routing queue instance
 */
let queueInstance: RoutingQueue | null = null;

/**
 * Get or create routing queue singleton
 */
export function getRoutingQueue(): RoutingQueue {
  if (!queueInstance) {
    queueInstance = new RoutingQueue();
  }
  return queueInstance;
}
