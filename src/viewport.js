export function fitDistance(aspect, fieldOfView = 34) {
  if (!Number.isFinite(aspect) || aspect <= 0) return 7.7;
  const halfFov = fieldOfView * Math.PI / 360;
  return Math.max(2.05 / Math.tan(halfFov), 1.7 / (Math.tan(halfFov) * aspect));
}

export function portraitPreviewWidth(stageHeight, columnWidth) {
  const contentHeight = Math.max(1, stageHeight - 26);
  return Math.max(1, Math.min(columnWidth - 24, contentHeight * 9 / 16 + 2));
}
