# Presage support draft — not sent

**Latest evidence and pending native result:** the user reports that the independent browser-based SDK probe also failed at both 720p and 480p, with validation **11 (`kFrameRateTooLow`)** and error **14**. A main sample showed about 9.4 handled frames/sec, but both copied snapshots were `phase: stopped` and their main samples were **4.9–5.5 seconds old**. The 480p report retained cached 1280×720 dimensions. These snapshots must not be presented as contemporaneous 480p ingestion measurements or proof of a specific bottleneck. A standalone Samsung browser test delivered about 29 FPS average, 26 minimum, 31 maximum.

One direct native acceptance command is now prepared: **`npm run sdk:native`**, from the native Windows checkout. It uses SDK 3.5.0 native enumeration, explicit `CameraSelection.byId()` (no default/fallback), `faceMetrics`, telemetry off, and SDK-owned camera capture in a plain Node child. It reports sanitized discovery/selection, start/Running status, validation/error codes and fresh validated expression counts, then stops/destroys the SDK. The selected camera's actual negotiated dimensions are not exposed by that API and are not invented. The worker follows the isolated native-camera approach inspected in [Glimra](https://github.com/0xaje/Glimra/blob/56a8ccf50b89ddc78ad09c0e6bacf66d5881576b/src/main/presageNativeWorker.cjs), while testing expressions rather than claiming landmark observations suffice. **No actual Samsung native result is established yet.** A WSL-shared-folder read-only Windows attempt timed out before discovery; it did not start capture and is not a Samsung failure result. Append the final JSON from the normal Windows acceptance run before drawing a native compatibility conclusion.

**Subject:** SmartSpectra Node 3.5.0 / Electron 43.8.1: Samsung Windows Virtual Camera ~29 FPS preview, no expression metrics, sustained-low-FPS error 14

We need help locating a frame-ingestion/processing bottleneck for genuine face-expression recognition. We have not identified the cause and have not established incompatibility with Windows Virtual Camera.

**Environment:** Dell Latitude 9420, Windows 11, Samsung S24 Ultra exposed as “Windows Virtual Camera”; `@smartspectra/node-sdk` pinned to 3.5.0; Electron 43.8.1; sandbox, context isolation and web security enabled, renderer Node integration disabled. Project: https://github.com/sopskistar/Cuelira, affected revision `e7fb00e0e82ca10bb353f3a3b63bdc9debd90b18`. Exact Windows build, CPU/power state and camera-source pixel format were not recorded.

**User-transcribed genuine recording measurements:** selected Samsung, negotiated 1280×720/30, measured pre-SDK preview 29.3 FPS, lowest two-second window 29.0, all four windows passed. SDK briefly Running; renderer receives initially zero and then approximately five `frameSentThrough(true)` callbacks/sec. No valid fresh expression metrics arrive. Session ends with `kSustainedLowFrameRate` (14). The preview works; this is not a request to repair camera permission or find another camera. Simultaneous preview cadence under SDK load and main-side ingestion timing have not yet been measured.

**Sanitized integration:**

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: { deviceId: { exact: selectedBrowserId },
    width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
});
const sdk = new SmartSpectraSDK({
  requestedMetrics: [...faceMetrics], // [11,12,13,14]
  enableTelemetry: false, enableAccumulatedOutput: false, sendTimeoutMs: 15000,
});
sdk.useMediaStream(stream);
sdk.on('frameSentThrough', sent => { if (sent) nativeTrueCount++; });
// Register validation/metrics/error handlers before start.
await sdk.start();
```

Main calls the official `bindSmartSpectraIpc(window)`. The official preload is bundled verbatim with the app's narrow bridge. A pinned main port listener injects the private API key only on `configure`, forces face metrics/telemetry off, and denies frame/start messages without consent. It does not rewrite frames or timestamps. The host owns/stops its original tracks; SDK owns its processor clone. No synthetic input, timer-driven frame generation, timestamp manipulation, frame-rate bypass or automatic retry is used.

**Source trace:** installed renderer uses TrackProcessor → OffscreenCanvas.drawImage/getImageData (RGBA) → contextBridge → structured-cloned MessagePort → main synchronous `sendFrame` → C ABI. Native `on_frame(sent, timestamp)` is separately marshalled through koffi and the return port. Its boolean callback is not the `sendFrame()` return value. Public docs do not establish a camera-FPS relationship. The official quickstart shares this path; it additionally draws charts and defaults to breathing metrics. Our request is face-only. No recorder or take checkpoint writer is active before the failed take can begin.

**Reduced reproducer prepared:** `npm run sdk:probe` in the repository. It uses the installed official modules with no React, scene engine, recorder, storage or Cuelira adapter. The main-only credential/consent shim is explicitly retained. It measures preview **during** SDK execution, main frame-handler rate, original timestamp cadence/gaps, handler duration, event-loop stalls, rate-limited drop warnings, true/false callback rates, and decoded-expression counts. No pixels, protobuf payloads, IDs or key are included in its copyable metadata report. `--baseline` disables the main timing observer. A 720p versus 640×480 comparison on the same Samsung is ready; **no real-device probe result is claimed yet**.

**Questions:**

1. Which native graph stage emits `on_frame` / `frameSentThrough` in 3.5.0? What does false mean? Is this callback decimated/rate-limited or guaranteed per accepted input frame? Is there a documented actual ingestion/processing-FPS diagnostic?
2. Which timestamps/stage drive error 14 with renderer custom input and face-only metrics? Can synchronous sendFrame block on graph capacity or callback relay on Windows?
3. Are there known Windows Virtual Camera / MediaStreamTrackProcessor / GPU readback or contextBridge copy limitations in this version? Which sanitized trace would distinguish them?
4. Is 640×480/30 supported for stable facial expressions, and what minimum face size/resolution should we enforce? Does native Windows camera discovery/capture support Microsoft's connected-camera source reliably?
5. Is there a supported lower-copy renderer or main-process capture path, or a released fix, that you recommend after reviewing the measured stage rates?

No private API key, device ID, raw frame, face recording, native log payload or account diagnostic is attached. The user can provide approved footage or additional sanitized measurements separately. Genuine expression metrics and an accepted scene cue remain unverified. Contact destination from official docs: **support@presagetech.com**. This draft has **not** been emailed or posted.
