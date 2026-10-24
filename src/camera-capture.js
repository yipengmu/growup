// Prefer a native capture format: matching a fixed aspect ratio can crop the source.
export function cameraCaptureConstraints() {
  return {
    video: {
      width: { ideal: 1280 }, height: { ideal: 720 },
      resizeMode: { ideal: 'none' }, facingMode: { ideal: 'user' },
    },
    audio: false,
  };
}

// Zoom units come from the device; they need not start at 1 or represent lens names.
export async function useWidestCamera(track) {
  try {
    const range = track?.getCapabilities?.().zoom;
    if (!Number.isFinite(range?.min) || !Number.isFinite(range?.max) || range.max <= range.min) {
      return '当前设备未开放镜头变焦 · 已保留完整采集画面';
    }
    await track.applyConstraints({
      ...track.getConstraints?.(),
      advanced: [{ zoom: range.min }],
    });
    const actual = track.getSettings?.().zoom;
    if (Number.isFinite(actual) && Math.abs(actual - range.min) < 0.001) {
      return '镜头广角 · 已使用设备最低变焦';
    }
    return '设备未确认最低变焦 · 已保留完整采集画面';
  } catch {
    // Optional camera controls must never prevent ordinary capture or tracking.
    return '镜头广角不可用 · 已保留完整采集画面';
  }
}
