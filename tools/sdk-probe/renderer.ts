import { SmartSpectraSDK, faceMetrics, ProcessingStatus, ValidationCode } from "@smartspectra/node-sdk/renderer";
import { decodeMetrics } from "@smartspectra/node-sdk/messages";

declare global {
  interface Window { sdkProbe: {
    info(): Promise<Record<string, unknown>>;
    consent(value: boolean): Promise<void>;
    onSample(callback: (sample: unknown) => void): void;
  } }
}
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const preview = element<HTMLVideoElement>("preview");
const camera = element<HTMLSelectElement>("camera");
const profile = element<HTMLSelectElement>("profile");
const consent = element<HTMLInputElement>("consent");
const open = element<HTMLButtonElement>("open");
const start = element<HTMLButtonElement>("start");
const stop = element<HTMLButtonElement>("stop");
const status = element("status");
const report = element("report");
let stream: MediaStream | null = null;
let sdk: SmartSpectraSDK | null = null;
let busy = false;
let generation = 0;
let previewCallback = 0;
let previewFrames = 0;
let lastPreviewCounter: number | null = null;
let cbTrue = 0, cbFalse = 0, metricsEvents = 0, expressionSamples = 0, validatedFresh = 0, decodeErrors = 0;
let validation: number | null = null;
let processing = "Not started";
let errorCode: number | string | null = null;
let previousTime = performance.now();
let previousMainTime = performance.now();
let mainSample: unknown = null;
let runtime: Record<string, unknown> = {};
let cameraSettings: Record<string, unknown> = {};
let closing: Promise<void> | null = null;
let teardownFailed = false;
let finalSample = false;
let transitionInWindow = true;
let lastExpressionTs = 0;
let longTasks = 0, longTaskMaxMs = 0;
let longTaskMeasurementAvailable = false;
const history: unknown[] = [];
const probeStarted = performance.now();
try {
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) { longTasks++; longTaskMaxMs = Math.max(longTaskMaxMs, entry.duration); }
  }).observe({ type: "longtask", buffered: false });
  longTaskMeasurementAvailable = true;
} catch { /* Unsupported browser: do not invent measurements. */ }
const safeLabel = (label: string) => label.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").slice(0, 100);
function controls() {
  consent.disabled = busy || !!closing || !!stream || !!sdk;
  camera.disabled = profile.disabled = busy || !!closing || !!stream || !!sdk || !consent.checked;
  open.disabled = teardownFailed || busy || !!closing || !!stream || !!sdk || !consent.checked;
  start.disabled = busy || !!closing || !stream || !!sdk;
  stop.disabled = !busy && !stream && !sdk;
}
function samplePreview(_now: number, metadata: VideoFrameCallbackMetadata) {
  if (lastPreviewCounter !== null) previewFrames += Math.max(0, metadata.presentedFrames - lastPreviewCounter);
  lastPreviewCounter = metadata.presentedFrames;
  previewCallback = preview.requestVideoFrameCallback(samplePreview);
}
async function cleanup() {
  transitionInWindow = true;
  generation++;
  preview.cancelVideoFrameCallback(previewCallback);
  const current = sdk; sdk = null;
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  preview.srcObject = null;
  finalSample = true;
  if (closing) return closing;
  closing = (async () => {
    try { if (current) await current.stop(); }
    catch { teardownFailed = true; status.textContent = "Native teardown failed. Close the probe before another run."; }
    finally { current?.destroy(); await window.sdkProbe.consent(false); }
  })();
  controls();
  try { await closing; } finally { closing = null; controls(); }
}
async function action(task: () => Promise<void>) {
  if (busy || closing || teardownFailed) return;
  busy = true; controls();
  try { await task(); }
  catch (error) {
    // Never display raw native messages (may contain account/path context).
    const e = error as { name?: string; code?: number | string };
    errorCode = typeof e.code === "number" ? e.code : e.code === "SMARTSPECTRA_IPC_TIMEOUT" ? e.code : "startup";
    status.textContent = `Probe stopped (${errorCode}${e.name === "NotAllowedError" ? ", access denied" : ""}). No recognition claimed.`;
    await cleanup();
  } finally { busy = false; controls(); }
}
consent.onchange = controls;
open.onclick = () => void action(async () => {
  if (!consent.checked) throw new Error("Consent required");
  const token = ++generation;
  await window.sdkProbe.consent(true);
  const incoming = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
    ...(camera.value ? { deviceId: { exact: camera.value } } : {}),
    width: { ideal: profile.value === "720" ? 1280 : 640 },
    height: { ideal: profile.value === "720" ? 720 : 480 }, frameRate: { ideal: 30 },
  } });
  if (token !== generation) { incoming.getTracks().forEach(t => t.stop()); return; }
  stream = incoming;
  transitionInWindow = true;
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  cameraSettings = { label: safeLabel(track.label), width: settings.width, height: settings.height,
    negotiatedFps: settings.frameRate, requestedFps: 30 };
  const selected = settings.deviceId ?? camera.value;
  camera.replaceChildren(new Option("System default", ""));
  for (const device of await navigator.mediaDevices.enumerateDevices())
    if (device.kind === "videoinput") camera.add(new Option(safeLabel(device.label) || "Unnamed camera", device.deviceId));
  camera.value = selected;
  track.addEventListener("ended", () => { status.textContent = "Selected camera ended."; void cleanup(); }, { once: true });
  preview.srcObject = stream;
  await preview.play();
  lastPreviewCounter = null;
  previewCallback = preview.requestVideoFrameCallback(samplePreview);
  status.textContent = "Preview active. Start the official SDK when ready. No camera-FPS gate in this independent test; SDK safety checks remain active.";
});
start.onclick = () => void action(async () => {
  runtime = await window.sdkProbe.info();
  if (!runtime.keyConfigured || !runtime.runtimeAvailable) {
    status.textContent = "Private key or native runtime unavailable. SDK not started.";
    await cleanup(); return;
  }
  if (!stream) throw new Error("No selected stream");
  const token = generation;
  cbTrue = cbFalse = metricsEvents = expressionSamples = validatedFresh = decodeErrors = 0;
  lastExpressionTs = 0;
  errorCode = null; validation = null;
  const current = (sdk = new SmartSpectraSDK({ requestedMetrics: [...faceMetrics],
    enableTelemetry: false, enableAccumulatedOutput: false, sendTimeoutMs: 15000 }));
  transitionInWindow = true;
  current.useMediaStream(stream);
  current.on("processingStatus", code => {
    if (token !== generation) return;
    processing = Object.entries(ProcessingStatus).find(([, value]) => code === value)?.[0] ?? String(code);
  });
  current.on("validationStatus", code => { if (token === generation) validation = code; });
  current.on("frameSentThrough", sent => { if (token === generation) { if (sent) cbTrue++; else cbFalse++; } });
  current.on("metrics", buffer => {
    if (token !== generation) return;
    metricsEvents++;
    try {
      const samples = decodeMetrics(buffer).face?.expression ?? [];
      expressionSamples += samples.length;
      for (const sample of samples) {
        const ts = Number(sample.timestamp);
        const ageMs = Date.now() - ts / 1000;
        if (Number.isSafeInteger(ts) && ts > lastExpressionTs) {
          lastExpressionTs = ts;
          if (validation === ValidationCode.kOk && sample.stable && ageMs >= -250 && ageMs <= 1200 &&
            sample.scores?.some(s => typeof s.type === "number" && s.type >= 1 && s.type <= 8 &&
              typeof s.confidence === "number" && Number.isFinite(s.confidence) && s.confidence >= 0 && s.confidence <= 100)) validatedFresh++;
        }
      }
    } catch { decodeErrors++; }
  });
  current.on("error", code => {
    if (token !== generation) return;
    errorCode = code;
    status.textContent = `SDK error ${code}${code === 14 ? " (kSustainedLowFrameRate)" : ""}. No automatic retry.`;
    void cleanup();
  });
  status.textContent = "Official SDK starting; count preview and native callbacks separately.";
  await current.start();
  if (token !== generation) return;
  status.textContent = "SDK started. Running alone is not expression recognition; inspect validated fresh sample counts.";
});
stop.onclick = () => { status.textContent = "Stop requested."; void cleanup(); };
window.sdkProbe.onSample(sample => { mainSample = sample; previousMainTime = performance.now(); });
setInterval(() => {
  const now = performance.now();
  const seconds = (now - previousTime) / 1000;
  if (stream) {
    const s = stream.getVideoTracks()[0].getSettings();
    cameraSettings = { ...cameraSettings, width: s.width, height: s.height, negotiatedFps: s.frameRate };
  }
  const sample = { secondsSinceProbeStarted: (now - probeStarted) / 1000,
    phase: sdk ? "sdk" : stream ? "preview" : "stopped", containsStartupOrStop: transitionInWindow,
    camera: cameraSettings, processing, validation, errorCode,
    rendererWindow: { elapsedSeconds: seconds, previewFps: previewFrames / seconds,
      nativeTrueCallbacksPerSecond: cbTrue / seconds, nativeFalseCallbacksPerSecond: cbFalse / seconds,
      metricsEvents, expressionSamples, validatedFreshSamples: validatedFresh, decodeErrors,
      rendererLongTaskMeasurementAvailable: longTaskMeasurementAvailable,
      rendererLongTasksOver50Ms: longTaskMeasurementAvailable ? longTasks : null,
      rendererLongTaskMaxMs: longTaskMeasurementAvailable ? longTaskMaxMs : null },
    mainSampleAgeMs: mainSample ? now - previousMainTime : null, main: mainSample };
  if (stream || sdk || busy || finalSample) {
    history.push(sample); if (history.length > 30) history.shift(); finalSample = false;
  }
  report.textContent = JSON.stringify({ runtime, ...sample }, null, 2);
  previewFrames = cbTrue = cbFalse = metricsEvents = expressionSamples = validatedFresh = decodeErrors = 0;
  previousTime = now;
  transitionInWindow = false;
  longTasks = longTaskMaxMs = 0;
}, 2000);
element<HTMLButtonElement>("snapshot").onclick = () => {
  const text = element<HTMLTextAreaElement>("snapshot-text");
  text.value = JSON.stringify({ runtime, camera: cameraSettings, errorCode, history,
    note: "Metadata only. Native callbacks are not physical camera FPS or an accepted cue. No frames included." }, null, 2);
  text.focus(); text.select();
};
void window.sdkProbe.info().then(info => { runtime = info; });
window.addEventListener("beforeunload", () => { stream?.getTracks().forEach(t => t.stop()); sdk?.destroy(); });
controls();
