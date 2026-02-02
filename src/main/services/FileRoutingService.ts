/**
 * File Routing Service - File Movement Based on Verification Status
 *
 * Routes files to appropriate directories based on verification/scanning results
 * Keeps verification logic pure - no file operations in VerificationService
 *
 * File routing flow:
 * Worker decides status → router moves file → logger records it → IPC notifies renderer
 */

import { rename, mkdir } from 'fs/promises';
import path from 'path';

export type FileStatus = 'tampered' | 'retry' | 'scan_passed' | 'upload_passed' | 'upload_failed';

export interface FileMovementOptions {
  createDirectories?: boolean;
}

export class FileRoutingService {
  /**
   * Get destination directory for a file based on status
   *
   * Directory structure:
   * input/
   * ├── files/
   * └── tampered/
   * └── retry/
   * └── scan_passed/
   * └── upload_passed/
   * └── upload_failed/
   */
  private getDestinationDirectory(sourceDir: string, status: FileStatus): string {
    const statusDirs: Record<FileStatus, string> = {
      tampered: 'tampered',
      retry: 'retry',
      scan_passed: 'scan_passed',
      upload_passed: 'upload_passed',
      upload_failed: 'upload_failed',
    };

    return path.join(sourceDir, statusDirs[status]);
  }

  /**
   * Move a file to its destination directory based on status
   *
   * @param filePath - Absolute path to the file
   * @param status - Verification/processing status
   * @param options - Movement options
   * @returns New file path after movement
   */
  async move(
    filePath: string,
    status: FileStatus,
    options: FileMovementOptions = { createDirectories: true }
  ): Promise<string> {
    try {
      const sourceDir = path.dirname(filePath);
      const fileName = path.basename(filePath);
      const destinationDir = this.getDestinationDirectory(sourceDir, status);
      const destinationPath = path.join(destinationDir, fileName);

      // Create destination directory if needed
      if (options.createDirectories) {
        try {
          await mkdir(destinationDir, { recursive: true });
        } catch (error) {
          console.warn(`[FileRouter] Failed to create directory ${destinationDir}:`, error);
          throw error;
        }
      }

      // Move the file
      try {
        await rename(filePath, destinationPath);
        console.log(`[FileRouter] File moved: ${fileName} → ${status}/`);
      } catch (error) {
        console.error(`[FileRouter] Failed to move file ${filePath}:`, error);
        throw error;
      }

      return destinationPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[FileRouter] File movement failed: ${filePath} (${status})`, errorMessage);
      throw new FileMovementError(
        `Failed to move file to ${status}/ directory: ${errorMessage}`,
        filePath,
        status
      );
    }
  }

  /**
   * Get display name for status (for UI/logs)
   */
  getStatusDisplayName(status: FileStatus): string {
    const displayNames: Record<FileStatus, string> = {
      tampered: 'Tampered',
      retry: 'Retry',
      scan_passed: 'Scan Passed',
      upload_passed: 'Upload Passed',
      upload_failed: 'Upload Failed',
    };

    return displayNames[status];
  }

  /**
   * Check if status indicates success
   */
  isSuccess(status: FileStatus): boolean {
    return status === 'scan_passed' || status === 'upload_passed';
  }

  /**
   * Check if status indicates failure
   */
  isFailure(status: FileStatus): boolean {
    return status === 'tampered' || status === 'upload_failed';
  }

  /**
   * Check if status indicates retry needed
   */
  isRetry(status: FileStatus): boolean {
    return status === 'retry';
  }
}

/**
 * Custom error for file movement failures
 */
export class FileMovementError extends Error {
  constructor(
    message: string,
    public filePath: string,
    public status: FileStatus
  ) {
    super(message);
    this.name = 'FileMovementError';
  }
}

/**
 * Global routing service instance
 */
let routingInstance: FileRoutingService | null = null;

/**
 * Get or create file routing service
 */
export function getFileRoutingService(): FileRoutingService {
  if (!routingInstance) {
    routingInstance = new FileRoutingService();
  }
  return routingInstance;
}

