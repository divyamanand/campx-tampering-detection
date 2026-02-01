import { ImageData } from "canvas";
import { readBarcodes, type ReadInputBarcodeFormat } from "zxing-wasm/reader";

export interface ScannerOptions {
  tryHarder?: boolean;
  formats?: ReadInputBarcodeFormat[];
  maxNumberOfSymbols?: number;
}

export interface BarcodeData {
  data: string;
  format: string;
  position: unknown;
}

export interface ScanResult {
  success: boolean;
  codes: BarcodeData[];
  error: string | null;
}

export class ScanImage {
  readerOptions: {
    tryHarder: boolean;
    formats: ReadInputBarcodeFormat[];
    maxNumberOfSymbols: number;
  };

  constructor(options: ScannerOptions = {}) {
    this.readerOptions = {
      tryHarder: options.tryHarder ?? true,
      formats: options.formats ?? ["QRCode", "Code128"],
      maxNumberOfSymbols: options.maxNumberOfSymbols ?? 2,
    };
  }


  async scan(imageData: ImageData): Promise<ScanResult> {
    try {
      const results = await readBarcodes(imageData, this.readerOptions);

      if (!results || results.length === 0) {
        return {
          success: false,
          codes: [],
          error: "NO_BARCODE_FOUND",
        };
      }

      return {
        success: true,
        codes: results.map((result) => ({
          data: result.text,
          format: result.format,
          position: result.position || null,
        })),
        error: null,
      };
    } catch (err) {
      return {
        success: false,
        codes: [],
        error: err instanceof Error ? err.message : "BARCODE_DECODE_FAILED",
      };
    }
  }
}

export const defaultScanner = new ScanImage();