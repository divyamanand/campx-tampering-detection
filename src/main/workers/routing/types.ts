/**
 * File Routing Worker - Type Definitions
 *
 * Type definitions for file routing operations:
 * - RoutingJob: represents a single file routing/movement operation
 * - RoutingJobWithResolver: extends RoutingJob with promise resolution functions
 * - Message types: for communication between main process and routing worker
 */

import type { FileStatus } from '../../services/FileRoutingService';

/**
 * Routing job for file movement
 *
 * Represents a single file that needs to be moved to a destination folder
 * based on its verification status. Jobs are queued in RoutingWorkerPool
 * and processed serially (one at a time) by the routing worker.
 */
export interface RoutingJob {
  /**
   * Unique job identifier
   * Used to match worker messages back to the job for promise resolution
   */
  id: string;

  /**
   * Original filename (without path)
   * Used for logging and error messages
   */
  fileName: string;

  /**
   * Full path to source file
   * The current location of the file that needs to be moved
   */
  sourcePath: string;

  /**
   * Base directory for file routing (from user settings)
   * Used to construct the destination path based on verification status
   */
  baseDir: string;

  /**
   * Final verification status of the PDF file
   * Determines which folder the file will be moved to:
   * - 'scanned': File passed scan with no issues
   * - 'suspicious': File passed scan but shows suspicious patterns
   * - 'tampered': File failed verification, detected tampering/forgery
   * - 'error': File could not be scanned due to errors
   */
  finalStatus: FileStatus;

  /**
   * Timestamp when job was created
   * Used for tracking and debugging job lifecycle
   */
  createdAt: number;
}

/**
 * Internal routing job with promise resolvers
 *
 * Extended version of RoutingJob used internally by RoutingWorkerPool.
 * Includes the promise resolution functions for async/await support.
 * NOT exposed to callers - purely internal data structure.
 */
export interface RoutingJobWithResolver extends RoutingJob {
  /**
   * Promise resolve function
   * Called when the file is successfully moved to destination
   */
  resolve: (value: any) => void;

  /**
   * Promise reject function
   * Called when file movement fails
   */
  reject: (error: Error) => void;
}

/**
 * Request message sent from main process to routing worker
 * Contains the file path and destination information
 */
export interface RoutingJobRequest {
  /**
   * Original PDF filename (without path)
   */
  fileName: string;

  /**
   * Full path to the source file that needs to be moved
   */
  sourcePath: string;

  /**
   * Base directory for routing operations
   * Used to compute destination paths
   */
  baseDir: string;

  /**
   * Verification status determining destination folder
   * - 'scanned': Clean files
   * - 'suspicious': Potentially problematic files
   * - 'tampered': Files with detected tampering
   * - 'error': Files that couldn't be scanned
   */
  finalStatus: FileStatus;
}

/**
 * Success result message sent from routing worker to main process
 * Indicates file was successfully moved to destination
 */
export interface RoutingResultMessage {
  /**
   * Message type identifier
   * Set to 'result' for successful operations
   */
  type: 'result';
}

/**
 * Error result message sent from routing worker to main process
 * Indicates file movement failed
 */
export interface RoutingErrorMessage {
  /**
   * Message type identifier
   * Set to 'error' for failed operations
   */
  type: 'error';

  /**
   * Error message describing what went wrong
   * Could be: "Failed to create folder", "File already exists", "Permission denied", etc.
   */
  error: string;
}

/**
 * Union type for all possible messages from routing worker
 * Used for type narrowing in message handlers
 */
export type RoutingMessage = RoutingResultMessage | RoutingErrorMessage;
