/**
 * Batch Orchestrator - Manages persistent directory scanning
 *
 * Responsibilities:
 * - Poll directory for new PDF files
 * - Maintain queue of files to process
 * - Create batches of fixed size
 * - Dispatch batches to worker pool
 * - Track progress and timing
 * - Control lifecycle (start, pause, resume, stop)
 * - Emit progress events
 * - Clean up memory between batches
 *
 * Does NOT:
 * - Touch renderer directly (emits events only)
 * - Decode PDFs (workers do)
 * - Talk to ZXing directly (workers do)
 */

import { readdir, readFile } from 'fs/promises';
import path from 'path';
import type { BatchSettings, BatchState, BatchProgressEvent, BatchResult } from '../../types/batchSettings.types';
import { DEFAULT_BATCH_SETTINGS } from '../../types/batchSettings.types';
import { getWorkerPool } from '../../workers/pdfScan/worker-pool.service';
import type { WorkerJob } from '../../workers/pdfScan/worker.types';
import { randomUUID } from 'crypto';
import { getBatchLogger } from '../logging/batch-logger.service';
import { createLogEntry } from '../../types/logEntry.types';
import { getRoutingWorkerPool } from '../../workers/routing/routing-worker-pool.service';
import type { FileStatus } from '../file-operations/file-routing.service';

/**
 * BatchOrchestrator - Manages batch directory scanning
 */
export class BatchOrchestrator {
  /**
   * Current batch settings
   */
  private settings: BatchSettings;

  /**
   * Queue of PDF file paths waiting to be processed
   */
  private queue: string[] = [];

  /**
   * Set of files already processed (to avoid duplicates)
   */
  private processedFiles: Set<string> = new Set();

  /**
   * Batch logger (created when batch starts)
   */
  private logger: ReturnType<typeof getBatchLogger> | null = null;

  /**
   * Current batch ID
   */
  private currentBatchId: string = '';

  /**
   * Current state
   */
  private state: BatchState = {
    active: false,
    paused: false,
    totalFiles: 0,
    processedFiles: 0,
    queuedFiles: 0,
    currentBatchIndex: 0,
    elapsedMs: 0,
  };

  /**
   * Directory polling timer (setInterval ID)
   */
  private pollTimer: NodeJS.Timeout | null = null;

  /**
   * Progress event callbacks
   */
  private progressCallbacks: Array<(event: BatchProgressEvent) => void> = [];

  /**
   * Batch execution start time
   */
  private batchStartTime: number = 0;

  /**
   * Progress stats for calculations
   */
  private stats = {
    totalFilesProcessed: 0,
    totalTimeElapsed: 0,
  };

  constructor(settings?: Partial<BatchSettings>) {
    // Merge with defaults
    this.settings = {
      ...DEFAULT_BATCH_SETTINGS,
      ...settings,
      directory: settings?.directory || '',
    } as BatchSettings;
  }

  /**
   * Start batch processing
   */
  async start(settings: BatchSettings): Promise<void> {
    if (this.state.active) {
      throw new Error('Batch processing already running');
    }

    if (!settings.directory) {
      throw new Error('Directory must be specified');
    }

    console.log(`[Orchestrator] Starting batch scan: ${settings.directory}`);

    this.settings = settings;
    this.state.active = true;
    this.state.paused = false;
    this.state.startedAt = Date.now();
    this.batchStartTime = Date.now();
    this.processedFiles.clear();
    this.queue = [];

    // Initialize logger (STEP 4.4, 4.6)
    this.logger = getBatchLogger(settings.directory);

    // Load previously processed files (STEP 4.7)
    const previouslyProcessed = await this.logger.getProcessedFiles();
    this.processedFiles = previouslyProcessed;

    // Start directory polling
    this.startPolling();

    // Start batch processing loop
    this.processingLoop();
  }

  /**
   * Pause batch processing (keep polling, don't process batches)
   */
  pause(): void {
    if (!this.state.active) {
      throw new Error('No batch processing running');
    }

    this.state.paused = true;
    console.log('[Orchestrator] Batch paused');
    this.emitProgress('batch-progress');
  }

  /**
   * Resume batch processing
   */
  resume(): void {
    if (!this.state.active) {
      throw new Error('No batch processing running');
    }

    if (!this.state.paused) {
      throw new Error('Batch is not paused');
    }

    this.state.paused = false;
    console.log('[Orchestrator] Batch resumed');
    this.emitProgress('batch-progress');
    this.processingLoop();
  }

  /**
   * Stop batch processing completely
   */
  async stop(): Promise<BatchResult> {
    if (!this.state.active) {
      throw new Error('No batch processing running');
    }

    console.log('[Orchestrator] Stopping batch...');

    this.state.active = false;
    this.stopPolling();

    // Complete batch logging if active (STEP 4.4)
    if (this.logger && this.currentBatchId) {
      try {
        await this.logger.completeBatch('CANCELLED');
      } catch (error) {
        console.warn('[Orchestrator] Failed to complete batch log:', error);
      }
    }

    const elapsed = Date.now() - (this.state.startedAt || Date.now());
    const result: BatchResult = {
      success: true,
      totalProcessed: this.state.processedFiles,
      failedCount: 0, // TODO: Track failures from logs
      successCount: this.state.processedFiles,
      totalElapsedMs: elapsed,
      averageTimePerFileMs:
        this.state.processedFiles > 0 ? Math.round(elapsed / this.state.processedFiles) : 0,
    };

    console.log(`[Orchestrator] Batch stopped. Processed: ${result.totalProcessed} files`);

    return result;
  }

  /**
   * Get current state
   */
  getState(): BatchState {
    const elapsed = Date.now() - (this.state.startedAt || Date.now());
    return {
      ...this.state,
      elapsedMs: elapsed,
      queuedFiles: this.queue.length,
    };
  }

  /**
   * Register progress callback
   */
  onProgress(callback: (event: BatchProgressEvent) => void): () => void {
    this.progressCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.progressCallbacks = this.progressCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Start polling directory for new files
   */
  private startPolling(): void {
    // Initial scan
    this.scanDirectory().catch((error) => {
      console.error('[Orchestrator] Initial directory scan failed:', error);
    });

    // Poll on interval
    this.pollTimer = setInterval(async () => {
      if (!this.state.active) {
        return; // Stop polling if not active
      }

      try {
        await this.scanDirectory();
      } catch (error) {
        console.error('[Orchestrator] Directory scan error:', error);
        this.emitProgress('batch-error', error instanceof Error ? error.message : 'Unknown error');
      }
    }, this.settings.pollingIntervalMs);

    console.log(`[Orchestrator] Polling started (interval: ${this.settings.pollingIntervalMs}ms)`);
  }

  /**
   * Stop polling directory
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      console.log('[Orchestrator] Polling stopped');
    }
  }

  /**
   * Scan directory for PDF files
   */
  private async scanDirectory(): Promise<void> {
    try {
      const entries = await readdir(this.settings.directory, { withFileTypes: true });

      // Filter PDFs and get full paths
      const pdfFiles = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
        .map((e) => path.join(this.settings.directory, e.name));

      // Add new files to queue (avoid duplicates)
      let newFilesCount = 0;
      for (const filePath of pdfFiles) {
        if (!this.processedFiles.has(filePath) && !this.queue.includes(filePath)) {
          this.queue.push(filePath);
          newFilesCount++;
        }
      }

      // Update state
      this.state.totalFiles = this.processedFiles.size + this.queue.length;
      this.state.queuedFiles = this.queue.length;

      if (newFilesCount > 0) {
        console.log(`[Orchestrator] Found ${newFilesCount} new files (queue size: ${this.queue.length})`);
      }
    } catch (error) {
      console.error('[Orchestrator] Failed to scan directory:', error);
      throw error;
    }
  }

  /**
   * Main processing loop
   * Runs batches sequentially while queue has files
   */
  private async processingLoop(): Promise<void> {
    // Check if already running (avoid concurrent loops)
    if (this.pollTimer === null && this.state.active) {
      console.warn('[Orchestrator] Processing loop already running');
      return;
    }

    while (this.state.active && !this.state.paused) {
      // Wait for files in queue
      if (this.queue.length === 0) {
        // Queue empty but still active (polling might add more)
        await this.delay(100);
        continue;
      }

      // Get next batch
      const batch = this.createBatch();
      if (batch.length === 0) {
        break;
      }

      this.state.currentBatchIndex++;

      try {
        // Start batch logging (STEP 4.4, 4.6)
        if (this.logger) {
          this.currentBatchId = await this.logger.startBatch({
            directory: this.settings.directory,
            batchSize: this.settings.batchSize,
            pollingIntervalMs: this.settings.pollingIntervalMs,
            totalFiles: batch.length,
          });
        }

        // Process batch
        await this.processBatch(batch);

        // Complete batch logging (STEP 4.5)
        if (this.logger) {
          await this.logger.completeBatch('COMPLETED');
        }

        // Clean up memory after batch
        await this.cleanupMemory();

        // Emit progress (STEP 4.8 - use log buffer as source of truth)
        if (this.logger) {
          this.emitProgress('batch-progress');
        }
      } catch (error) {
        console.error('[Orchestrator] Batch processing error:', error);
        // Complete batch log with error
        if (this.logger) {
          await this.logger.completeBatch('FAILED', error instanceof Error ? error : new Error(String(error)));
        }
        this.emitProgress('batch-error', error instanceof Error ? error.message : 'Batch failed');
        // Continue with next batch on error
      }
    }

    // Loop finished
    if (this.state.active && !this.state.paused) {
      this.emitProgress('batch-progress');
    }
  }

  /**
   * Create a batch from the queue
   */
  private createBatch(): string[] {
    const batchSize = this.settings.batchSize;
    const q =  this.queue.splice(0, batchSize);
    console.log("QUEUE AFTER SPLICE", this.queue.length)
    return q
  }

  /**
   * Process a single batch (submit to worker pool)
   *
   * Flow:
   * 1. Read files and submit scanning jobs
   * 2. Wait for results (with verification status)
   * 3. Enqueue routing jobs (non-blocking)
   * 4. Log results
   */
  private async processBatch(files: string[]): Promise<void> {
    const pool = getWorkerPool();
    const routingPool = getRoutingWorkerPool();

    console.log(
      `[Orchestrator] Processing batch ${this.state.currentBatchIndex} (${files.length} files)`
    );

    const batchStartTime = Date.now();

    // Define job result types for better type safety
    type JobSuccess = { filePath: string; fileName: string; success: true; result: any };
    type JobError = { filePath: string; fileName: string; success: false; error: Error };
    type JobResult = JobSuccess | JobError;

    // Create jobs for all files in batch
    const jobPromises = files.map(async (filePath): Promise<JobResult> => {
      const jobId = randomUUID();
      const fileName = path.basename(filePath);

      try {
        // Read file buffer
        const fileBuffer = await readFile(filePath);

        const job: WorkerJob = {
          id: jobId,
          buffer: fileBuffer.buffer as ArrayBuffer,
          fileName,
          config: {
            initialScale: this.settings.pdfConfig?.initialScale ?? 3,
            enableRotation: this.settings.pdfConfig?.enableRotation ?? true,
            rotationDegrees: this.settings.pdfConfig?.rotationDegrees ?? 180,
          },
          resolve: () => {},
          reject: () => {},
          onProgress: () => {
            // Progress from individual files
          },
        };

        return pool.submit(job).then((result) => {
          this.state.processedFiles++;
          this.processedFiles.add(filePath);
          this.stats.totalFilesProcessed++;
          return { filePath, fileName, success: true, result } as JobSuccess;
        });
      } catch (error) {
        console.error(`[Orchestrator] Failed to read file ${filePath}:`, error);
        return {
          filePath,
          fileName,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        } as JobError;
      }
    });

    // Wait for all jobs in batch (allSettled = one failure doesn't kill batch)
    const results = await Promise.allSettled(jobPromises);

    // Process results: log and enqueue routing
    for (let i = 0; i < results.length; i++) {
      const filePath = files[i];
      const fileName = path.basename(filePath);
      const result = results[i];
      const fileStartTime = batchStartTime + i * 100; // Approximate
      const fileEndTime = Date.now();

      let logEntry;
      let shouldRoute = false;
      let fileStatus: FileStatus | null = null;

      if (result.status === 'fulfilled' && result.value.success) {
        // Worker succeeded - safe to access result.value.result
        const jobResult = result.value.result;
        const verificationResult = jobResult.verificationResult;

        // Determine file status from verification result
        if (verificationResult?.status === 'tampered') {
          fileStatus = 'tampered';
          shouldRoute = true;
          logEntry = createLogEntry({
            fileName,
            absolutePath: filePath,
            batchId: this.currentBatchId,
            batchIndex: this.state.currentBatchIndex,
            startTime: fileStartTime,
            endTime: fileEndTime,
            durationMs: fileEndTime - fileStartTime,
            status: 'PARTIAL',
            results: jobResult.results || {},
            totalPages: jobResult.totalPages || 0,
            error: {
              message: `Tampering detected: ${verificationResult.reason}`,
              code: 'TAMPERING_DETECTED',
              timestamp: fileEndTime,
            },
            config: {
              initialScale: this.settings.pdfConfig?.initialScale ?? 3,
              enableRotation: this.settings.pdfConfig?.enableRotation ?? true,
              rotationDegrees: this.settings.pdfConfig?.rotationDegrees ?? 180,
            },
            metadata: {
              tags: ['tampered', 'routed'],
            },
          });
          console.log(`[Orchestrator] File routed: ${fileName} → tampered/`);
        } else if (verificationResult?.status === 'scan_passed') {
          // Scan passed verification
          fileStatus = 'scan_passed';
          shouldRoute = true;
          logEntry = createLogEntry({
            fileName,
            absolutePath: filePath,
            batchId: this.currentBatchId,
            batchIndex: this.state.currentBatchIndex,
            startTime: fileStartTime,
            endTime: fileEndTime,
            durationMs: fileEndTime - fileStartTime,
            status: 'SUCCESS',
            results: jobResult.results || {},
            totalPages: jobResult.totalPages || 0,
            config: {
              initialScale: this.settings.pdfConfig?.initialScale ?? 3,
              enableRotation: this.settings.pdfConfig?.enableRotation ?? true,
              rotationDegrees: this.settings.pdfConfig?.rotationDegrees ?? 180,
            },
            metadata: {
              tags: ['scan_passed', 'routed'],
            },
          });
          console.log(`[Orchestrator] File routed: ${fileName} → scan_passed/`);
        } else {
          // Verification result missing or unknown status - keep in main directory
          shouldRoute = false;
          logEntry = createLogEntry({
            fileName,
            absolutePath: filePath,
            batchId: this.currentBatchId,
            batchIndex: this.state.currentBatchIndex,
            startTime: fileStartTime,
            endTime: fileEndTime,
            durationMs: fileEndTime - fileStartTime,
            status: 'PARTIAL',
            results: jobResult.results || {},
            totalPages: jobResult.totalPages || 0,
            error: {
              message: `Verification result missing or unknown status - file kept in main directory`,
              code: 'VERIFICATION_UNDEFINED',
              timestamp: fileEndTime,
            },
            config: {
              initialScale: this.settings.pdfConfig?.initialScale ?? 3,
              enableRotation: this.settings.pdfConfig?.enableRotation ?? true,
              rotationDegrees: this.settings.pdfConfig?.rotationDegrees ?? 180,
            },
            metadata: {
              tags: ['not_routed', 'verification_missing'],
            },
          });
          console.log(`[Orchestrator] File NOT routed: ${fileName} (verification undefined) - kept in main directory`);
        }
      } else {
        // Worker failed - keep file in main directory, don't route
        let error: Error;
        if (result.status === 'fulfilled' && !result.value.success) {
          error = result.value.error;
        } else {
          error = result.status === 'rejected' ? result.reason : new Error('Unknown error');
        }
        shouldRoute = false;
        logEntry = createLogEntry({
          fileName,
          absolutePath: filePath,
          batchId: this.currentBatchId,
          batchIndex: this.state.currentBatchIndex,
          startTime: fileStartTime,
          endTime: fileEndTime,
          durationMs: fileEndTime - fileStartTime,
          status: 'FAILED',
          results: {},
          totalPages: 0,
          error: {
            message: error instanceof Error ? error.message : String(error),
            timestamp: fileEndTime,
          },
          config: {
            initialScale: this.settings.pdfConfig?.initialScale ?? 3,
            enableRotation: this.settings.pdfConfig?.enableRotation ?? true,
            rotationDegrees: this.settings.pdfConfig?.rotationDegrees ?? 180,
          },
          metadata: {
            tags: ['not_routed', 'worker_failed'],
          },
        });
        console.log(`[Orchestrator] File NOT routed: ${fileName} (worker failed) - kept in main directory`);
      }

      // Submit routing job only for tampered and scan_passed files
      if (shouldRoute && fileStatus) {
        try {
          await routingPool.submit({
            id: randomUUID(),
            fileName,
            sourcePath: filePath,
            baseDir: this.settings.directory,
            finalStatus: fileStatus,
            createdAt: Date.now(),
          });
          console.log(`[Orchestrator] Routing job queued: ${fileName} (${fileStatus})`);
        } catch (routingError) {
          console.error(`[Orchestrator] Failed to route file ${fileName}:`, routingError);
          // Don't fail batch - log it and continue
          logEntry.metadata = logEntry.metadata || {};
          logEntry.metadata.tags = [...(logEntry.metadata.tags || []), 'routing_failed'];
        }
      }

      // Add entry to logger
      if (this.logger) {
        this.logger.addEntry(logEntry);
      }
    }

    // Count successes and failures
    const successes = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failures = results.length - successes;

    const batchDuration = Date.now() - batchStartTime;
    this.stats.totalTimeElapsed += batchDuration;

    console.log(
      `[Orchestrator] Batch ${this.state.currentBatchIndex} complete: ${successes}/${files.length} succeeded (${batchDuration}ms)`
    );

    if (failures > 0) {
      console.warn(`[Orchestrator] ${failures} files failed in batch`);
    }
  }

  /**
   * Clean up memory after batch
   * Forces garbage collection and clears references
   */
  private async cleanupMemory(): Promise<void> {
    // Force garbage collection if available (requires --expose-gc flag)
    if (global.gc) {
      global.gc();
      console.log('[Orchestrator] Garbage collection triggered');
    }

    // Clear temporary arrays
    // (main arrays are already cleared by createBatch via splice)

    // Small delay to let GC complete
    await this.delay(10);
  }

  /**
   * Emit progress event to all listeners
   */
  private emitProgress(
    type: 'batch-progress' | 'batch-complete' | 'batch-error',
    errorMsg?: string
  ): void {
    const elapsed = Date.now() - (this.state.startedAt || Date.now());
    const totalToProcess = this.state.totalFiles;
    const remaining = this.state.queuedFiles;

    // Calculate throughput
    const throughputPerSec =
      elapsed > 0 ? (this.state.processedFiles / (elapsed / 1000)).toFixed(2) : '0';

    // Estimate remaining time
    const remainingTimeMs =
      throughputPerSec !== '0' ? (remaining / parseFloat(throughputPerSec)) * 1000 : 0;
    const estimatedRemainingMins = Math.ceil(remainingTimeMs / 60000);

    const event: BatchProgressEvent = {
      type,
      processedInBatch: 0, // TODO: Track per batch
      totalProcessed: this.state.processedFiles,
      totalFiles: totalToProcess,
      batchIndex: this.state.currentBatchIndex,
      queuedFiles: remaining,
      elapsedMs: elapsed,
      throughputPerSec: parseFloat(throughputPerSec),
      estimatedRemainingMins: remainingTimeMs > 0 ? estimatedRemainingMins : undefined,
      error: errorMsg,
    };

    // Emit to all listeners
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[Orchestrator] Progress callback error:', error);
      }
    });
  }

  /**
   * Helper: delay for async sleep
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance
 */
let orchestratorInstance: BatchOrchestrator | null = null;

/**
 * Get or create orchestrator singleton
 */
export function getOrchestrator(): BatchOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new BatchOrchestrator();
  }
  return orchestratorInstance;
}
