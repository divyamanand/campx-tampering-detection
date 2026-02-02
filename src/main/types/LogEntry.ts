/**
 * Logging Architecture for Batch Processing
 *
 * Design principles:
 * - Log at file level (one entry per PDF)
 * - Batch-aware (each batch = separate log file)
 * - Crash-safe (header written immediately)
 * - Worker-agnostic (workers just return data)
 * - Resume-friendly (enables recovery from crashes)
 */

/**
 * Status of a file processing
 */
export type ProcessingStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'SKIPPED';

/**
 * A single log entry for one PDF file
 * Created when file processing completes
 */
export interface LogEntry {
  /**
   * File identifier
   */
  fileName: string;
  absolutePath: string;

  /**
   * Batch information
   */
  batchId: string;
  batchIndex: number;

  /**
   * Timing information (milliseconds)
   */
  startTime: number; // Unix timestamp when processing started
  endTime: number;   // Unix timestamp when processing ended
  durationMs: number; // Total duration

  /**
   * Processing outcome
   * MANDATORY - every entry must have a status
   */
  status: ProcessingStatus;

  /**
   * Processing results
   * - SUCCESS: Contains extracted barcodes/QR codes
   * - FAILED: Empty object
   * - PARTIAL: Partial results (some pages succeeded)
   * - SKIPPED: Empty object
   */
  results: Record<number, unknown>; // page number → detection results

  /**
   * Total pages in PDF
   */
  totalPages: number;

  /**
   * Pages that were successfully processed
   * (only if status !== SUCCESS or PARTIAL)
   */
  successfulPages?: number;

  /**
   * Error information (only if status === FAILED or PARTIAL)
   */
  error?: {
    message: string;
    code?: string;
    stack?: string;
    timestamp: number;
  };

  /**
   * Processing configuration used
   */
  config: {
    initialScale: number;
    enableRotation: boolean;
    rotationDegrees: number;
  };

  /**
   * Metadata for resume/recovery
   */
  metadata?: {
    workerIndex?: number;
    retryCount?: number;
    tags?: string[];
  };
}

/**
 * Batch log header
 * Written at start of batch processing (crash safety)
 */
export interface BatchLogHeader {
  /**
   * Unique batch identifier
   */
  batchId: string;

  /**
   * When batch started
   */
  startTime: number; // Unix timestamp

  /**
   * Batch configuration
   */
  batchSettings: {
    directory: string;
    batchSize: number;
    pollingIntervalMs: number;
  };

  /**
   * Status of batch
   * - STARTED: Header written, processing ongoing
   * - COMPLETED: All files processed
   * - FAILED: Error during processing
   * - CANCELLED: User stopped
   */
  status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

  /**
   * Total files in this batch
   */
  totalFiles: number;

  /**
   * When batch ended (only if status !== STARTED)
   */
  endTime?: number;

  /**
   * Error if batch failed
   */
  error?: {
    message: string;
    timestamp: number;
  };
}

/**
 * Complete batch log file structure
 */
export interface BatchLogFile {
  /**
   * Schema version (for future compatibility)
   */
  version: '1.0';

  /**
   * Header (written first, guarantees batch was started)
   */
  header: BatchLogHeader;

  /**
   * Array of file processing entries
   * (added as files complete)
   */
  entries: LogEntry[];

  /**
   * Statistics calculated at end
   */
  stats?: {
    totalProcessed: number;
    totalSucceeded: number;
    totalFailed: number;
    totalPartial: number;
    totalSkipped: number;
    averageDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
  };
}

/**
 * In-memory log buffer
 * Used during batch processing
 */
export interface LogBuffer {
  /**
   * Batch identifier
   */
  batchId: string;

  /**
   * Batch header (written immediately for crash safety)
   */
  header: BatchLogHeader;

  /**
   * Entries accumulated during batch
   * (flushed to disk after batch completes)
   */
  entries: LogEntry[];

  /**
   * Track if buffer has been flushed
   */
  flushed: boolean;

  /**
   * Timestamp of last entry added
   */
  lastEntryTime: number;
}

/**
 * Default log entry
 */
export function createLogEntry(overrides?: Partial<LogEntry>): LogEntry {
  const now = Date.now();
  return {
    fileName: '',
    absolutePath: '',
    batchId: '',
    batchIndex: 0,
    startTime: now,
    endTime: now,
    durationMs: 0,
    status: 'FAILED',
    results: {},
    totalPages: 0,
    config: {
      initialScale: 3,
      enableRotation: true,
      rotationDegrees: 180,
    },
    ...overrides,
  };
}

/**
 * Default batch log header
 */
export function createBatchLogHeader(batchId: string, overrides?: Partial<BatchLogHeader>): BatchLogHeader {
  return {
    batchId,
    startTime: Date.now(),
    batchSettings: {
      directory: '',
      batchSize: 4,
      pollingIntervalMs: 5000,
    },
    status: 'STARTED',
    totalFiles: 0,
    ...overrides,
  };
}

/**
 * Calculate stats from log entries
 */
export function calculateLogStats(entries: LogEntry[]): BatchLogFile['stats'] {
  if (entries.length === 0) {
    return {
      totalProcessed: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      totalPartial: 0,
      totalSkipped: 0,
      averageDurationMs: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
    };
  }

  const durations = entries.map((e) => e.durationMs);
  const totalDuration = durations.reduce((a, b) => a + b, 0);

  return {
    totalProcessed: entries.length,
    totalSucceeded: entries.filter((e) => e.status === 'SUCCESS').length,
    totalFailed: entries.filter((e) => e.status === 'FAILED').length,
    totalPartial: entries.filter((e) => e.status === 'PARTIAL').length,
    totalSkipped: entries.filter((e) => e.status === 'SKIPPED').length,
    averageDurationMs: Math.round(totalDuration / entries.length),
    minDurationMs: Math.min(...durations),
    maxDurationMs: Math.max(...durations),
  };
}
