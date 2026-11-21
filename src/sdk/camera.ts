// Local, temporary diagnostics only. Never read pixels, record, persist or send
// diagnostic data. Browser device IDs remain in memory for exact selection.
export const CAMERA_TARGET_FPS = 30;
export const CAMERA_MIN_FPS = 25; // Presage measurement-quality guidance, not an SDK override.
export type CameraProfile = "720p" | "480p";
export type CameraChoice = { id: string; label: string };
export type CameraReport = {
  label: string;
  width?: number;
  height?: number;
  requestedFps: number;
  negotiatedFps?: number;
  measuredFps: number | null;
  lowestWindowFps: number | null;
  windows: number;
  ready: boolean;
  phase: "measuring" | "checked" | "capturing" | "stopped";
  warning: string;
  sdkFps?: number;
};

export function safeCameraLabel(label: string, index = 0) {
  return label
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s*\([^)]*(?:[0-9a-f]{4}:[0-9a-f]{4})[^)]*\)/gi, "")
    .trim().slice(0, 100) || `Camera ${index + 1}`;
}

export function cameraConstraints(deviceId: string, profile: CameraProfile): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }),
      width: { ideal: profile === "720p" ? 1280 : 640 },
      height: { ideal: profile === "720p" ? 720 : 480 },
      frameRate: { ideal: CAMERA_TARGET_FPS },
    },
  };
}

export function cameraFailure(error: unknown): Error {
  const name = (error as { name?: unknown })?.name;
  const detail = name === "NotAllowedError" || name === "SecurityError"
    ? "Camera permission denied. Consent in Cuelira and enable Windows Settings → Privacy & security → Camera → desktop app access, then retry."
    : name === "NotFoundError" || name === "OverconstrainedError"
      ? "Selected camera is unavailable or cannot negotiate this capture mode. Reconnect the phone/webcam, refresh cameras, select an available device and retry."
      : name === "NotReadableError" || name === "AbortError"
        ? "Camera could not be opened. Close Camera, Teams, Zoom and webcam test tabs; reconnect the selected device, then retry."
        : "Camera startup failed. Check Windows camera access and the selected device, then retry.";
  return new Error(detail);
}

export function cameraSummary(track: MediaStreamTrack): CameraReport {
  const s = track.getSettings();
  const label = safeCameraLabel(track.label);
  const infrared = /\b(?:ir|infrared|depth)\b/i.test(label);
  return {
    label, width: s.width, height: s.height,
    requestedFps: CAMERA_TARGET_FPS, negotiatedFps: s.frameRate,
    measuredFps: null, lowestWindowFps: null, windows: 0,
    ready: false, phase: "measuring",
    warning: infrared
      ? "This label suggests an infrared/depth camera. Select a physical RGB built-in or directly connected USB webcam."
      : "Confirm this is your physical color webcam. A label alone cannot verify device type; virtual/phone cameras are unsupported by Presage.",
  };
}

export type FpsResult = { measuredFps: number; lowestWindowFps: number; windows: number; ready: boolean };
export function summarizeFps(windows: { frames: number; elapsedMs: number }[]): FpsResult {
  const valid = windows.length > 0 && windows.every(w => Number.isFinite(w.elapsedMs) && w.elapsedMs > 0 && Number.isFinite(w.frames) && w.frames >= 0);
  const elapsed = windows.reduce((n, w) => n + w.elapsedMs, 0);
  const measuredFps = valid ? windows.reduce((n, w) => n + w.frames, 0) * 1000 / elapsed : 0;
  const lowestWindowFps = valid ? Math.min(...windows.map(w => w.frames * 1000 / w.elapsedMs)) : 0;
  return { measuredFps, lowestWindowFps, windows: windows.length,
    ready: valid && windows.length === 4 && lowestWindowFps >= CAMERA_MIN_FPS };
}

// Counts compositor-delivered video frames over real elapsed time (including
// stalls). Not requestAnimationFrame, timer ticks or getSettings().frameRate.
// This is a preview delivery check, not the SDK's device-readiness verdict.
export async function measureCameraFps(
  video: HTMLVideoElement,
  signal: AbortSignal,
  progress: (result: FpsResult) => void,
): Promise<FpsResult> {
  if (typeof video.requestVideoFrameCallback !== "function")
    throw new Error("Delivered FPS measurement is unavailable. Restart the supported Electron desktop app.");
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let callback = 0;
    let frames = 0;
    let lastCounter: number | null = null;
    let baseline = 0;
    let lastTime = 0;
    const windows: { frames: number; elapsedMs: number }[] = [];
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      video.cancelVideoFrameCallback(callback);
      signal.removeEventListener("abort", abort);
      document.removeEventListener("visibilitychange", visibility);
    };
    const fail = (message: string) => { cleanup(); reject(new Error(message)); };
    const abort = () => fail("Camera check canceled. Camera off.");
    const visibility = () => {
      if (document.visibilityState !== "visible")
        fail("Keep Cuelira visible in the foreground while checking camera FPS, then retry.");
    };
    const tick: VideoFrameRequestCallback = (_now, metadata) => {
      if (lastCounter !== null) frames += Math.max(0, metadata.presentedFrames - lastCounter);
      lastCounter = metadata.presentedFrames;
      callback = video.requestVideoFrameCallback(tick);
    };
    const sample = () => {
      const now = performance.now();
      windows.push({ frames: frames - baseline, elapsedMs: now - lastTime });
      baseline = frames;
      lastTime = now;
      const result = summarizeFps(windows);
      progress(result);
      if (windows.length === 4) { cleanup(); resolve(result); }
      else timer = setTimeout(sample, 2000);
    };
    signal.addEventListener("abort", abort, { once: true });
    document.addEventListener("visibilitychange", visibility);
    callback = video.requestVideoFrameCallback(tick);
    timer = setTimeout(() => {
      baseline = frames; lastTime = performance.now();
      timer = setTimeout(sample, 2000);
    }, 1000); // Exposure warm-up; then four two-second windows, including freezes.
    visibility();
  });
}
