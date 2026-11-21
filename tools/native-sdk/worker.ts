// Direct native camera ownership, in a disposable plain Node child. No Electron,
// renderer, MediaStream, raw-frame IPC, recovery loop or timestamp rewriting.
import { config } from "dotenv";
import path from "node:path";
import { NativeCounts, nativeCameraName, nativeVerdict } from "./counts";
import type { CameraInfo, SmartSpectraSDK as NativeSdk } from "@smartspectra/node-sdk";

config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
delete process.env.SMARTSPECTRA_DIAGNOSTICS;
const counts = new NativeCounts();
let sdk: NativeSdk | null = null;
let cameras: CameraInfo[] = [];
let closing: Promise<void> | null = null;
let attempted = false;
let startReturned = false;
let stage = "sdk-load";
let selected: { index: number; name: string } | null = null;
let duration: ReturnType<typeof setTimeout> | undefined;
let progress: ReturnType<typeof setInterval> | undefined;
const emit = (message: object) => { if (process.connected) process.send?.(message); };

async function finish(reason: string) {
  if (closing) return closing;
  closing = Promise.resolve().then(async () => {
    clearTimeout(duration); clearInterval(progress);
    let cleanup = "complete";
    try { if (sdk) await sdk.stopAsync(); } catch { cleanup = "failed"; }
    try { if (sdk) await sdk.destroy(); } catch { cleanup = "failed"; }
    sdk = null;
    emit({ type: "summary", reason, stage, selected, sdkStartReturned: startReturned, cleanup,
      verdict: reason === "completed" || reason === "sdk-error" || reason === "startup-error"
        ? nativeVerdict(counts.snapshot(), cleanup) : `INCONCLUSIVE_${reason.toUpperCase().replaceAll("-", "_")}`,
      counts: counts.snapshot() });
    process.disconnect?.();
  });
  return closing;
}

async function main() {
  const { SmartSpectraSDK, CameraSelection, faceMetrics, SmartSpectraLogLevel } =
    require("@smartspectra/node-sdk") as typeof import("@smartspectra/node-sdk");
  stage = "native-discovery";
  cameras = SmartSpectraSDK.availableCameras();
  emit({ type: "discovery", sdkVersion: SmartSpectraSDK.version,
    cameras: cameras.map((c, index) => ({ index, name: nativeCameraName(c.name === c.id ? null : c.name, index) })) });
  stage = "waiting-for-selection";
  process.on("message", message => {
    const m = message as { type?: string; index?: unknown; consent?: unknown } | null;
    if (!m || typeof m !== "object") return;
    if (m.type === "stop") { void finish("canceled"); return; }
    if (m.type !== "start" || attempted || closing) return;
    attempted = true;
    if (m.consent !== true || !Number.isInteger(m.index) || typeof m.index !== "number" || !cameras[m.index]) {
      void finish("invalid-selection-or-consent"); return;
    }
    const camera = cameras[m.index];
    selected = { index: m.index, name: nativeCameraName(camera.name === camera.id ? null : camera.name, m.index) };
    const key = process.env.PRESAGE_API_KEY || process.env.SMARTSPECTRA_API_KEY || "";
    if (!key.trim() || key.startsWith("replace_")) { void finish("missing-key"); return; }
    try {
      stage = "sdk-configuration";
      sdk = new SmartSpectraSDK({ apiKey: key, requestedMetrics: [...faceMetrics],
        enableTelemetry: false, enableAccumulatedOutput: false, logLevel: SmartSpectraLogLevel.kNone });
      sdk.on("processingStatus", code => { if (!closing) counts.state(code); });
      sdk.on("validationStatus", code => { if (!closing) counts.validate(code); });
      sdk.on("metrics", buffer => {
        if (closing) return;
        counts.metrics(buffer, Date.now());
      });
      sdk.on("error", code => {
        if (closing) return;
        counts.error(code);
        // Do not invoke native lifecycle functions inside a native callback.
        setImmediate(() => void finish("sdk-error"));
      });
      // Exact SDK-discovered ID; never default/fallback to a different camera.
      // SDK camera defaults match the native reference; no forced constraints.
      stage = "exact-camera-selection";
      sdk.useCamera(CameraSelection.byId(camera.id));
      stage = "native-start";
      sdk.start();
      startReturned = true;
      stage = "native-capture";
      emit({ type: "started", selected, captureRequest: "SDK camera defaults; actual negotiated mode is not exposed by this API" });
      progress = setInterval(() => emit({ type: "progress", counts: counts.snapshot() }), 5000);
      duration = setTimeout(() => void finish("completed"), 30000);
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (typeof code === "number") counts.error(code);
      setImmediate(() => void finish("startup-error"));
    }
  });
}
process.on("disconnect", () => { void finish("parent-disconnected"); });
process.on("SIGTERM", () => { void finish("canceled"); });
process.on("uncaughtException", () => { void finish("worker-exception"); });
process.on("unhandledRejection", () => { void finish("worker-rejection"); });
void main().catch(error => {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === "number") counts.error(code);
  emit({ type: "discovery-failed" });
  void finish("discovery-failed");
});
