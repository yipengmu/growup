export function faceCrop(points, width, height) {
  if (!points || width < 1 || height < 1) return null;
  if (![0,2,5,7,8].every((index) => points[index] && Number.isFinite(points[index].x) && Number.isFinite(points[index].y) && (points[index].visibility ?? 1) > 0.6)) return null;
  const eyeSpan = Math.abs(points[2].x - points[5].x) * width;
  if (eyeSpan < 8) return null;
  const earSpan = Math.abs(points[7].x - points[8].x) * width;
  const cropWidth = Math.min(width, Math.max(earSpan * 1.25, eyeSpan * 3.3));
  const cropHeight = Math.min(height, cropWidth * 1.2);
  const centerX = (points[7].x + points[8].x) / 2 * width;
  const centerY = points[0].y * height - cropHeight * 0.12;
  return { x: Math.max(0, Math.min(width - cropWidth, centerX - cropWidth / 2)), y: Math.max(0, Math.min(height - cropHeight, centerY - cropHeight / 2)), width: cropWidth, height: cropHeight };
}
