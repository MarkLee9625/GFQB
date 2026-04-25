export interface AutoFitResult {
  scale: number;
  posX: number;
  posY: number;
}

export const calculateAutoFitPosition = (
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number
): AutoFitResult => {
  const targetScale = Math.max(
    containerWidth / imageWidth,
    containerHeight / imageHeight
  );

  const cssScale = Math.min(
    containerWidth / imageWidth,
    containerHeight / imageHeight,
    1
  );

  const scale = targetScale / cssScale;
  const posX = 0;
  const posY = 0;

  return { scale, posX, posY };
};