/**
 * Worker Message Contract
 *
 * Defines the message types exchanged between main process and PDF scanning worker
 */

export interface WorkerScanRequest {
  id: string;
  buffer: ArrayBuffer;
  fileName: string;
  config: {
    initialScale: number;
    enableRotation: boolean;
    rotationDegrees: number;
  };
}

export interface WorkerProgressEvent {
  type: "progress";
  id: string;
  fileName: string;
  pageNumber: number;
  totalPages: number;
}

export interface WorkerResultEvent {
  type: "result";
  id: string;
  fileName: string;
  success: boolean;
  results: Record<number, unknown>;
  totalPages: number;
  error?: string;
  /**
   * Verification result (if verification was performed)
   * - status: 'scan_passed' | 'retry' | 'tampered'
   * - reason: (optional) detailed reason for non-passed status
   */
  verificationResult?: {
    status: 'scan_passed' | 'retry' | 'tampered';
    reason?: string;
  };
}

export type WorkerMessage = WorkerProgressEvent | WorkerResultEvent;

export interface WorkerErrorEvent {
  type: "error";
  id: string;
  fileName: string;
  error: string;
}
