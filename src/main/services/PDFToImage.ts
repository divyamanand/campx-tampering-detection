import { createCanvas, ImageData } from "canvas";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;


export interface PDFToImageOptions {
  imageType?: string;
  imageQuality?: number;
}

export interface ImageResult {
  imageData: ImageData | null;
  width: number;
  height: number;
  scale: number;
}


export class PDFToImage {
  imageType: string;
  imageQuality: number;

  constructor(options: PDFToImageOptions = {}) {
    this.imageType = options.imageType ?? "image/png";
    this.imageQuality = options.imageQuality ?? 1;
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

  async convertPageToImage(page: PDFPageProxy, scale: number): Promise<ImageResult> {
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d")!;


    await page.render({
      canvasContext: ctx,
      viewport,
    } as any).promise;

    const imageData = ctx.getImageData(0,0,viewport.width, viewport.height)
    page.cleanup()

    // Cleanup canvas
    canvas.width = canvas.height = 0;

    return {
      imageData,
      width: viewport.width,
      height: viewport.height,
      scale,
    };
  }
}

// Default singleton instance for convenience
export const defaultPDFToImage = new PDFToImage();