/**
 * Worker Job Definition
 *
 * Represents a single PDF scanning job to be processed by a worker
 * Encapsulates all necessary data + promise resolution
 */
/**
 * Represents a single job to be processed by a worker
 * Each job has a unique ID for message routing
 */
export interface WorkerJob {
  /**
   * Unique job identifier for routing responses
   * Used to match worker messages back to the correct handler
   */
  id: string;

  /**
   * PDF file buffer (ArrayBuffer, not Uint8Array)
   * Will be transferred to worker (zero-copy)
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
   * Job creation timestamp (for debugging)
   */
  createdAt?: number;

  /**
   * Job assignment timestamp (when assigned to a worker)
   */
  assignedAt?: number;
}

/**
 * Worker state tracking
 */
export interface WorkerState {
  /**
   * The actual worker thread
   */
  worker: import('worker_threads').Worker;

  /**
   * Whether this worker is currently processing a job
   */
  busy: boolean;

  /**
   * The job currently being processed (if busy)
   */
  currentJob?: WorkerJob;

  /**
   * Worker initialization timestamp
   */
  createdAt: number;

  /**
   * Number of jobs completed by this worker
   */
  jobsCompleted: number;

  /**
   * Total time spent processing (ms)
   */
  totalProcessingTime: number;
}

/**
 * Job queue statistics
 */
export interface PoolStats {
  /**
   * Total workers in the pool
   */
  totalWorkers: number;

  /**
   * Number of currently busy workers
   */
  busyWorkers: number;

  /**
   * Number of currently idle workers
   */
  idleWorkers: number;

  /**
   * Jobs waiting in queue
   */
  queuedJobs: number;

  /**
   * Total jobs processed since pool creation
   */
  totalJobsProcessed: number;

  /**
   * Average job processing time (ms)
   */
  averageJobTime: number;
}
