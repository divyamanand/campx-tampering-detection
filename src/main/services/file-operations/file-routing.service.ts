/**
 * File Routing Service - Low-level File System Operations
 *
 * ONLY does file system operations:
 * - Create directories
 * - Move files
 *
 * NO business logic, NO status mapping, NO verification
 * Business logic lives in RoutingQueue and pdfRouting.worker
 *
 * Used by: pdfRouting.worker.ts
 */

import { rename, mkdir } from 'fs/promises';
import path from 'path';

export type FileStatus = 'tampered' | 'scan_passed' | 'retry';

/**
 * File Routing Service - Pure FS operations
 */
export class FileRoutingService {
  /**
   * Get destination folder name for a status
   */
  private getFolderNameForStatus(status: FileStatus): string {
    const folderNames: Record<FileStatus, string> = {
      tampered: 'tampered',
      scan_passed: 'scan_passed',
      retry: 'retry',
    };
    return folderNames[status];
  }

  /**
   * Get destination path for a file
   * baseDir/status/filename
   */
  getDestinationPath(baseDir: string, fileName: string, status: FileStatus): string {
    const folderName = this.getFolderNameForStatus(status);
    return path.join(baseDir, folderName, fileName);
  }

  /**
   * Ensure a folder exists (create if needed)
   * Called before moving files into it
   *
   * @param folderPath - Absolute path to folder
   */
  async ensureFolder(folderPath: string): Promise<void> {
    try {
      await mkdir(folderPath, { recursive: true });
    } catch (error) {
      console.error(`[FileRouter] Failed to create folder ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * Move file atomically from source to destination
   *
   * @param sourcePath - Absolute path to source file
   * @param destinationPath - Absolute path to destination file
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      await rename(sourcePath, destinationPath);
    } catch (error) {
      console.error(`[FileRouter] Failed to move file from ${sourcePath} to ${destinationPath}:`, error);
      throw error;
    }
  }

  /**
   * Get display name for status (for UI/logs only)
   */
  getStatusDisplayName(status: FileStatus): string {
    const displayNames: Record<FileStatus, string> = {
      tampered: 'Tampered',
      scan_passed: 'Scan Passed',
      retry: 'Retry'
    };
    return displayNames[status];
  }
}

/**
 * Custom error for file movement failures
 */
export class FileMovementError extends Error {
  constructor(
    message: string,
    public sourcePath: string,
    public destinationPath: string
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
