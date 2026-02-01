import type { PDFPageProxy } from "pdfjs-dist";
import { ScanImage, type ScanResult } from "./ScanImage";
import { PDFToImage } from "./PDFToImage";
import { rotateImage } from "./imageUtils";
import { ImageData } from "canvas";

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


  async processFile(
    pdfFile: File,
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
    const fileName = pdfFile.name;
    const fileResults: Record<number, PageProcessResult> = {};
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await this.pdfToImage.loadDocument(arrayBuffer);
    const totalPages = pdf.numPages

    try {
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const pageResult = await this.processPage(page, pageNum);

        // Store result in local object
        fileResults[pageNum] = {
          result: pageResult.result,
          scale: pageResult.scale,
          rotated: pageResult.rotated,
          success: pageResult.success,
        };

        // Progress callback
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
      if (pdf) {
        await pdf.destroy()

      }
    }
  }
}

// Export a factory function for convenience
export function createPDFManager(config: PDFManagerConfig = {}): PDFManager {
  return new PDFManager(config);
}