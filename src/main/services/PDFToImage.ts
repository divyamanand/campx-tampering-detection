import { createCanvas, ImageData } from "canvas";
import type { PDFPageProxy } from "pdfjs-dist";

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