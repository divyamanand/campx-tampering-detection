/**
 * Verification Service - PDF Tampering Detection
 *
 * Implements per-file verification logic inside the worker
 * All verification happens BEFORE moving files
 *
 * Verification hierarchy:
 * 1. Immediate exit (tampered):
 *    - verifyPageCount (page count % 8 !== 0)
 *    - verifyCodeValue (code doesn't match fileName)
 *    - verifyFileCorrectness (Code128 !== fileName)
 *
 * 2. Continue scanning, final retry (if any missing QRs):
 *    - verifyMissingQRs (QR/Code128 missing on pages)
 *
 * 3. Per-page, no early exit:
 *    - verifyOCRSerialNumber (placeholder for OCR service)
 */

import type { PageProcessResult, PDFManagerConfig } from '../pdf/pdf-manager.service';

export type VerificationResult =
  | { status: 'scan_passed' }
  | { status: 'tampered'; reason: string };

export interface VerificationContext {
  fileName: string;
  filePath: string;
  totalPages: number;
  pageResults: Record<number, PageProcessResult>;
  config: PDFManagerConfig;
}

export class VerificationService {
  /**
   * Verify page count divisibility
   * Pages must be divisible by 8
   *
   * EARLY EXIT if failed → tampered
   */
  verifyPageCount(context: VerificationContext): VerificationResult | null {
    const { totalPages, fileName } = context;

    if (totalPages % 8 !== 0) {
      return {
        status: 'tampered',
        reason: `Page count ${totalPages} is not divisible by 8`,
      };
    }

    return null;
  }

  /**
   * Extract QR code from barcode data
   * QR format contains: fileName-serialNumber
   */
  private extractQRValue(barcodeFormat: string, data: string): string | null {
    if (barcodeFormat === 'QRCode') {
      return data;
    }
    return null;
  }

  /**
   * Extract Code128 barcode value
   */
  private extractCode128Value(barcodeFormat: string, data: string): string | null {
    if (barcodeFormat === 'Code128') {
      return data;
    }
    return null;
  }

  /**
   * Verify code values match fileName
   * - Code128: must match fileName exactly
   * - QR: first part (before '-') must match fileName
   *
   * EARLY EXIT if failed → tampered
   */
  verifyCodeValue(context: VerificationContext, pageNumber: number): VerificationResult | null {
    const { fileName, pageResults } = context;
    const pageResult = pageResults[pageNumber];

    if (!pageResult || !pageResult.result.success || pageResult.result.codes.length === 0) {
      // No codes found - will be caught by verifyMissingQRs
      return null;
    }

    const codes = pageResult.result.codes;

    for (const code of codes) {
      const code128Value = this.extractCode128Value(code.format, code.data);
      const qrValue = this.extractQRValue(code.format, code.data);

      // Code128 check
      if (code128Value !== null) {
        if (code128Value !== fileName) {
          return {
            status: 'tampered',
            reason: `Code128 value "${code128Value}" does not match fileName "${fileName}" on page ${pageNumber}`,
          };
        }
      }

      // QR check
      if (qrValue !== null) {
        const qrFileName = qrValue.split('-')[0];
        if (qrFileName !== fileName) {
          return {
            status: 'tampered',
            reason: `QR code fileName "${qrFileName}" does not match fileName "${fileName}" on page ${pageNumber}`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Verify missing QRs and Code128 barcodes
   *
   * Rules:
   * - QR missing on ANY page → retry
   * - Code128 missing on FIRST page → retry
   *
   * Does NOT exit early (collects all failures, final decision = retry)
   */
  verifyMissingQRs(context: VerificationContext): VerificationResult | null {
    const { totalPages, pageResults, fileName } = context;
    const missingDetails: string[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageResult = pageResults[pageNum];

      if (!pageResult || !pageResult.result.success || pageResult.result.codes.length === 0) {
        missingDetails.push(`Page ${pageNum}: No codes found`);
        continue;
      }

      const codes = pageResult.result.codes;
      const hasQR = codes.some((c) => c.format === 'QRCode');
      const hasCode128 = codes.some((c) => c.format === 'Code128');

      // QR missing on ANY page
      if (!hasQR) {
        missingDetails.push(`Page ${pageNum}: Missing QR code`);
      }

      // Code128 missing on FIRST page
      if (pageNum === 1 && !hasCode128) {
        missingDetails.push(`Page ${pageNum}: Missing Code128 barcode (required on first page)`);
      }
    }

    if (missingDetails.length > 0) {
      return {
        status: 'tampered',
        reason: `Missing barcodes: ${missingDetails.join('; ')}`,
      };
    }

    return null;
  }

  /**
   * Verify file correctness (stronger than retry)
   *
   * Rule:
   * - Code128 !== fileName → immediate exit, tampered
   *
   * This is a stronger check than verifyCodeValue
   * Fails immediately, no further scanning
   */
  verifyFileCorrectness(context: VerificationContext): VerificationResult | null {
    const { fileName, pageResults } = context;

    // Check Code128 on first page (most critical)
    const firstPageResult = pageResults[1];
    if (!firstPageResult || !firstPageResult.result.success || firstPageResult.result.codes.length === 0) {
      return {
        status: 'tampered',
        reason: 'Unable to verify file correctness: No codes found on first page',
      };
    }

    const codes = firstPageResult.result.codes;
    const code128 = codes.find((c) => c.format === 'Code128');

    if (!code128) {
      return {
        status: 'tampered',
        reason: 'File integrity check failed: Code128 barcode missing on first page',
      };
    }

    if (code128.data !== fileName) {
      return {
        status: 'tampered',
        reason: `File integrity check failed: Code128 "${code128.data}" !== fileName "${fileName}"`,
      };
    }

    return null;
  }

  /**
   * Verify OCR serial number
   *
   * Currently a placeholder
   * Architecture supports per-page verification
   * Can be extended to depend on OCR service
   */
  verifyOCRSerialNumber(context: VerificationContext, pageNumber: number): VerificationResult | null {
    // Placeholder for future OCR service integration
    // Would extract serial number from OCR and verify consistency
    return null;
  }

  /**
   * Main verification pipeline
   *
   * Flow:
   * 1. verifyPageCount (immediate exit if failed)
   * 2. verifyFileCorrectness (immediate exit if failed)
   * 3. For each page:
   *    - verifyCodeValue (immediate exit if failed)
   *    - verifyOCRSerialNumber (no early exit)
   * 4. verifyMissingQRs (no early exit, final decision)
   * 5. Return result
   *
   * Result priority:
   * 1. tampered (any tamper detected)
   * 2. retry (missing codes, but not tampered)
   * 3. scan_passed (all checks passed)
   */
  verify(context: VerificationContext): VerificationResult {
    // Step 1: Page count check (immediate exit)
    const pageCountResult = this.verifyPageCount(context);
    if (pageCountResult?.status === 'tampered') {
      return pageCountResult;
    }

    // Step 2: File correctness check (immediate exit)
    const fileCorrectnessResult = this.verifyFileCorrectness(context);
    if (fileCorrectnessResult?.status === 'tampered') {
      return fileCorrectnessResult;
    }

    // Step 3: Per-page verification (immediate exit on tamper)
    for (let pageNum = 1; pageNum <= context.totalPages; pageNum++) {
      const codeValueResult = this.verifyCodeValue(context, pageNum);
      if (codeValueResult?.status === 'tampered') {
        return codeValueResult;
      }

      // OCR verification (no early exit, can collect multiple failures)
      // Note: Currently a placeholder
      this.verifyOCRSerialNumber(context, pageNum);
    }

    // Step 4: Missing QRs check (final decision, no early exit)
    const missingQRsResult = this.verifyMissingQRs(context);
    if (missingQRsResult) {
      // If missing QRs detected (marked as tampered), return early
      return missingQRsResult;
    }

    // All checks passed
    return { status: 'scan_passed' };
  }
}

/**
 * Global verification service instance
 */
let verificationInstance: VerificationService | null = null;

/**
 * Get or create verification service
 */
export function getVerificationService(): VerificationService {
  if (!verificationInstance) {
    verificationInstance = new VerificationService();
  }
  return verificationInstance;
}
