import { createCanvas, ImageData } from "canvas";

export function rotateImage(
  imageData: ImageData,
  rotationDegrees: number = 180
): ImageData {
  const radians = ((rotationDegrees % 360) * Math.PI) / 180;

  const srcWidth = imageData.width;
  const srcHeight = imageData.height;

  const swap = rotationDegrees === 90 || rotationDegrees === 270;
  const destWidth = swap ? srcHeight : srcWidth;
  const destHeight = swap ? srcWidth : srcHeight;

  // Source canvas
  const srcCanvas = createCanvas(srcWidth, srcHeight);
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.putImageData(imageData, 0, 0);

  // Destination canvas
  const destCanvas = createCanvas(destWidth, destHeight);
  const destCtx = destCanvas.getContext("2d");

  // Rotate around center
  destCtx.translate(destWidth / 2, destHeight / 2);
  destCtx.rotate(radians);
  destCtx.drawImage(
    srcCanvas,
    -srcWidth / 2,
    -srcHeight / 2
  );

  return destCtx.getImageData(0, 0, destWidth, destHeight);
}
