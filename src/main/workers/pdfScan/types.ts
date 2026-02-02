/**
 * PDF Scan Worker - Type Definitions
 *
 * Comprehensive type definitions for PDF scanning worker pool:
 * - WorkerJob: represents a single PDF scanning job
 * - WorkerState: tracks the state of an individual worker thread
 * - PoolStats: aggregated statistics for the entire worker pool
 * - Message types: for communication between main process and worker thread
 */

import type { Worker } from 'worker_threads';

/**
 * Represents a single job to be processed by a PDF scanning worker
 * Each job has a unique ID for message routing and promise resolution
 */
export interface WorkerJob {
  /**
   * Unique job identifier for routing responses
   * Used to match worker messages back to the correct handler
   */
  id: string;

  /**
   * PDF file buffer (ArrayBuffer, not Uint8Array)
   * Will be transferred to worker (zero-copy transfer for performance)
   */
  buffer: ArrayBuffer;

  /**
   * Name of the PDF file being scanned
   * Used for logging and error messages
   */
  fileName: string;

  /**
   * Configuration for PDF processing
   * Includes scale, rotation settings, etc.
   */
  config: {
    initialScale: number;
    enableRotation: boolean;
    rotationDegrees: number;
  };

  /**
   * Resolve function for the job promise
   * Called when job completes successfully
   * Receives the scan result object
   */
  resolve: (value: any) => void;

  /**
   * Reject function for the job promise
   * Called when job fails
   * Receives the error
   */
  reject: (error: Error) => void;

  /**
   * Optional progress callback
   * Called with progress updates during scanning
   * Typically sent to renderer via IPC
   */
  onProgress?: (data: { fileName: string; pageNumber: number; totalPages: number }) => void;

  /**
   * Job creation timestamp (for debugging and performance tracking)
   */
  createdAt?: number;

  /**
   * Job assignment timestamp (when assigned to a worker)
   */
  assignedAt?: number;
}

/**
 * Worker state tracking
 *
 * Represents the internal state of a single worker thread in the pool.
 * Used by WorkerPool to manage worker lifecycle, job assignment, and statistics.
 */
export interface WorkerState {
  /**
   * The actual worker thread instance
   * Communication happens via worker.postMessage() and 'message' event listener
   */
  worker: Worker;

  /**
   * Whether this worker is currently processing a job
   * True = busy processing, False = idle and available for new jobs
   */
  busy: boolean;

  /**
   * The job currently being processed (if busy)
   * Undefined when worker is idle
   */
  currentJob?: WorkerJob;

  /**
   * Worker initialization timestamp
   * Used for worker lifecycle tracking and debugging
   */
  createdAt: number;

  /**
   * Number of jobs completed by this worker
   * Used for load balancing and statistics
   */
  jobsCompleted: number;

  /**
   * Total time spent processing (ms)
   * Sum of all job processing times for this worker
   */
  totalProcessingTime: number;
}

/**
 * Job queue statistics
 *
 * Provides aggregated metrics for the entire worker pool.
 * Used for monitoring, debugging, and performance analysis.
 */
export interface PoolStats {
  /**
   * Total workers in the pool
   * This is typically the WORKER_POOL_SIZE from config
   */
  totalWorkers: number;

  /**
   * Number of currently busy workers
   * Workers processing jobs right now
   */
  busyWorkers: number;

  /**
   * Number of currently idle workers
   * Workers available for new jobs
   */
  idleWorkers: number;

  /**
   * Jobs waiting in queue
   * Jobs submitted but not yet assigned to a worker
   */
  queuedJobs: number;

  /**
   * Total jobs processed since pool creation
   * Cumulative count across all workers
   */
  totalJobsProcessed: number;

  /**
   * Average job processing time (ms)
   * Calculated as totalProcessingTime / totalJobsProcessed
   * Used for performance analysis and capacity planning
   */
  averageJobTime: number;
}

/**
 * Request message sent from main process to PDF scanning worker
 * Contains the PDF data and configuration needed for scanning
 */
export interface WorkerScanRequest {
  /**
   * Unique job identifier
   * Used to route the response back to the correct promise resolver
   */
  id: string;

  /**
   * ArrayBuffer containing the raw PDF file bytes
   * Transferred to worker, not copied (zero-copy performance)
   */
  buffer: ArrayBuffer;

  /**
   * Original PDF filename
   * Used for logging and error messages in the worker
   */
  fileName: string;

  /**
   * PDF processing configuration
   * Determines how the PDF is scanned and analyzed
   */
  config: {
    initialScale: number;
    enableRotation: boolean;
    rotationDegrees: number;
  };
}

/**
 * Progress event sent from PDF scanning worker to main process
 * Emitted as each page is processed
 */
export interface WorkerProgressEvent {
  type: 'progress';

  /**
   * Job ID matching the original request
   */
  id: string;

  /**
   * Original PDF filename
   */
  fileName: string;

  /**
   * Current page being processed (1-indexed)
   */
  pageNumber: number;

  /**
   * Total number of pages in the PDF
   */
  totalPages: number;
}

/**
 * Result event sent from PDF scanning worker to main process
 * Emitted when job completes successfully or with results
 */
export interface WorkerResultEvent {
  type: 'result';

  /**
   * Job ID matching the original request
   */
  id: string;

  /**
   * Original PDF filename
   */
  fileName: string;

  /**
   * Whether the scan was successful
   * true = processed without errors, false = errors during processing
   */
  success: boolean;

  /**
   * Scan results indexed by page number
   * Contains the detection/analysis data for each page
   */
  results: Record<number, unknown>;

  /**
   * Total number of pages that were scanned
   */
  totalPages: number;

  /**
   * Optional error message if scan failed
   */
  error?: string;

  /**
   * Verification result (if verification was performed in worker)
   * Indicates whether the PDF passed tampering checks
   * - 'scan_passed': No tampering detected
   * - 'retry': Inconclusive, recommend retry
   * - 'tampered': Tampering detected
   */
  verificationResult?: {
    status: 'scan_passed' | 'retry' | 'tampered';
    reason?: string;
  };
}

/**
 * Error event sent from PDF scanning worker to main process
 * Emitted when job fails with an error
 */
export interface WorkerErrorEvent {
  type: 'error';

  /**
   * Job ID matching the original request
   */
  id: string;

  /**
   * Original PDF filename
   */
  fileName: string;

  /**
   * Error message describing what went wrong
   */
  error: string;
}

/**
 * Union type for all possible messages from worker thread
 * Used for type narrowing in message handlers
 */
export type WorkerMessage = WorkerProgressEvent | WorkerResultEvent | WorkerErrorEvent;
