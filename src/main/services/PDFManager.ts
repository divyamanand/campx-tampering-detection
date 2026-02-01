import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { ScanImage, type ScanResult } from "./ScanImage";
import { PDFToImage } from "./PDFToImage";
import { rotateImage } from "./imageUtils";
import { ImageData } from "canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

export interface PDFManagerConfig {
  initialScale?: number;
  enableRotation?: boolean;
  rotationDegrees?: number;
}

export interface PageProcessResult {
  success: boolean;
  result: ScanResult;
  scale: number;
  rotated: boolean;
}

const DEFAULT_CONFIG: Required<PDFManagerConfig> = {
  initialScale: 3,
  enableRotation: true,
  rotationDegrees: 180,
};

export class PDFManager {
  config: Required<PDFManagerConfig>;
  scanner: ScanImage;
  pdfToImage: PDFToImage;


  constructor(config: PDFManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scanner = new ScanImage();
    this.pdfToImage = new PDFToImage();
  }

  async tryScan(imageData: ImageData): Promise<{ result: ScanResult; rotated: boolean }> {
    const result = await this.scanner.scan(imageData);
    return { result, rotated: false };
  }
  async tryScanWithRotation(imageData: ImageData, rotationDegrees? : number): Promise<{ result: ScanResult; rotated: boolean }> {
 
      const rotatedImage = rotateImage(imageData, rotationDegrees);
      const result = await this.scanner.scan(rotatedImage);
      return { result, rotated: true };
  }

  countCodes(result: ScanResult) {
    return result.codes.length
  }

  async processPage(page: PDFPageProxy, pageNumber: number): Promise<PageProcessResult> {
    try {

      const imageResult = await this.pdfToImage.convertPageToImage(page, this.config.initialScale);
      
      let bestResult: { result: ScanResult; rotated: boolean };
      const { result, rotated } = await this.tryScan(imageResult.imageData!);
      bestResult = {result, rotated}
      
      if (this.config.enableRotation) {
        const {result, rotated} = await this.tryScanWithRotation(imageResult.imageData!, this.config.rotationDegrees)
        if (this.countCodes(result) > this.countCodes(bestResult.result)) {
          bestResult = {result, rotated}
        }
      }

      return {
        success: bestResult.result.success,
        result: bestResult.result,
        scale: this.config.initialScale,
        rotated: bestResult.rotated
      };
    } catch (err) {
      console.warn(`Error processing page ${pageNumber}:`, err);
      return {
        success: false,
        result: {
          success: false,
          codes: [],
          error: "FAILED_TO_DETECT_ANY_CODE",
        },
        scale: this.config.initialScale,
        rotated: false,
      };
    }
  }

  async loadDocument(
    input: ArrayBuffer | Uint8Array | Buffer
  ): Promise<PDFDocumentProxy> {
    let data: Uint8Array;
  
    if (Buffer.isBuffer(input)) {
      data = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else if (input instanceof Uint8Array) {
      data = input;
    } else {
      data = new Uint8Array(input);
    }
  
    return pdfjsLib.getDocument({ data }).promise;
  }


  async processBuffer(
  input: ArrayBuffer | Uint8Array | Buffer,
  fileName = "document.pdf",
  onPageComplete?: ((data: {
    fileName: string;
    pageNumber: number;
    totalPages: number;
    pageResult: PageProcessResult;
  }) => void) | null
): Promise<{
  fileName: string;
  totalPages: number;
  results: Record<number, PageProcessResult>;
  success: boolean;
  error?: string;
}> {
  const fileResults: Record<number, PageProcessResult> = {};

  const pdf = await this.loadDocument(input);
  const totalPages = pdf.numPages;

  console.log("PDF Details", pdf, totalPages)

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const pageResult = await this.processPage(page, pageNum);

      fileResults[pageNum] = pageResult;

      if (onPageComplete) {
        onPageComplete({
          fileName,
          pageNumber: pageNum,
          totalPages,
          pageResult,
        });
      }
    }

    return {
      fileName,
      totalPages,
      results: fileResults,
      success: true,
    };
  } catch (err) {
    return {
      fileName,
      totalPages: 0,
      results: fileResults,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    await pdf.destroy();
  }
}

}

// Export a factory function for convenience
export function createPDFManager(config: PDFManagerConfig = {}): PDFManager {
  return new PDFManager(config);
}