# SmartSpectra integration and live verification

**Direct-native acceptance is now prepared:** `npm run sdk:native` runs the installed 3.5.0 SDK in an isolated plain Node child, enumerates native camera names/indices, requires explicit Samsung selection/consent, and uses `useCamera(CameraSelection.byId(nativeId))`. It reports only safe counters and numeric codes and awaits native cleanup. [Run the single Windows test](TESTING.md#single-direct-native-acceptance-test). No native rehearsal integration has been enabled without actual Samsung fresh-expression evidence. Both latest browser snapshots were stopped/stale; their cached dimensions and rates are not current 480p processing measurements.

**Latest blocker investigation:** the user reports a working Samsung Windows Virtual Camera preview at 29.3 FPS (lowest window 29.0), brief Running, approximately five true native callbacks/sec and error 14, with no valid fresh expressions. The callback count is **not verified input/camera FPS**. See [SDK_BLOCKER_DIAGNOSIS.md](SDK_BLOCKER_DIAGNOSIS.md) for the installed-source trace, official quickstart comparison, independent probe and unresolved classification; [PRESAGE_SUPPORT_REPORT.md](PRESAGE_SUPPORT_REPORT.md) is ready but unsent. The production frame pipeline and validation remain unchanged.

I pinned `@smartspectra/node-sdk` to **3.5.0** and inspected the installed JavaScript, generated messages and declarations, plus the [official starter](https://github.com/Presage-Security/SmartSpectra/tree/main/nodejs/samples/electron-quickstart), [Node guide](https://smartspectra.presagetech.com/docs/nodejs/), [API reference](https://smartspectra.presagetech.com/docs/nodejs/api-reference) and [metrics guide](https://smartspectra.presagetech.com/docs/nodejs/metrics). I read the official `using-smartspectra` skill from the inspected repository; I did not install a duplicate global skill.

## Actual configuration and transport

```ts
new SmartSpectraSDK({
  requestedMetrics: [...faceMetrics],
  enableTelemetry: false,
  enableAccumulatedOutput: false,
  sendTimeoutMs: 15000,
});
```

The renderer imports from `/renderer`. Cuelira now opens one consented camera with `navigator.mediaDevices.getUserMedia({audio:false, video:…})`, measures its delivered preview FPS, then calls **`sdk.useMediaStream(theSameStream)` before `sdk.start()`**. Main calls `bindSmartSpectraIpc(window)` from `/main`; the sandboxed preload incorporates the official `/preload` script without changing it. The [official messages decoder](https://smartspectra.presagetech.com/docs/nodejs/api-reference) decodes metrics buffers. No `electron-rebuild`, `node-gyp`, custom native input loop or browser-only SDK is introduced.

`faceMetrics` is `[11,12,13,14]`: landmarks, blinking, talking and expressions. The scene uses expressions; the other bundle members are not retained in take reports. The default SDK breathing bundle would not satisfy this product, so the face bundle is explicit in both renderer and main policy.

## Private credential boundary

`PRESAGE_API_KEY` (or `SMARTSPECTRA_API_KEY`) is read in main from the environment or the private local `.env`. No credential getter is exposed. The official bridge currently expects configuration on `smartspectra:attach` and has no main-only key injection option. Using Electron's public `ipcMain.prependListener` and `MessagePortMain.prependListener`, I apply a small policy before the official listener: inject the private key, force face metrics, disable telemetry, reject capture messages without consent and block insights. I do not fork the SDK or invoke its hidden native methods.

This is a **version-pinned transport policy**, not a promised upstream extension API. `tests/sdk.test.ts` checks the installed version, bundle and wire strings; `tests/storage.test.ts` checks policy behavior. Port-listener ordering and a successful live start with a real credential still need Windows acceptance. The app catches native-load failure and disables genuine capture rather than pretending it succeeded. A future upstream credential callback would be preferable.

## Error 14 investigation and camera selection (November 21, 2026)

The installed **3.5.0** `js/constants.js` and `js/index.d.ts` export `SmartSpectraErrorCode.kSustainedLowFrameRate === 14`. The installed `docs/device-readiness.md` and [official Node readiness guide](https://smartspectra.presagetech.com/docs/nodejs/device-readiness/) specify the error callback `(code, message, retryable)`. Its canonical message is: “SmartSpectra stopped because the frame rate stayed too low to measure reliably.” Camera/custom-input failures are retryable through a **user-initiated** fresh start. Cuelira never restarts automatically. Error 14 is distinct from authentication (2), input unavailable (7), timestamp errors (10/11), and metric authorization (13); it no longer advises changing credentials.

The [measurement-quality guide](https://smartspectra.presagetech.com/docs/measurement-quality/) recommends sustaining roughly **25 FPS or higher**, targeting **30 FPS**, and identifies dim-light exposure and CPU/GPU contention as possible causes of reduced delivery. This is published guidance, not a claim that the SDK has one universal hard-coded 25-FPS cutoff or that a preview check guarantees SDK success.

User-reported Windows 11 / Dell Latitude 9420 evidence: real face visible, SDK briefly Running, no fresh valid expression metrics, then error 14. Separate WebcamTests.com result for **OV01AS**: average 10 FPS, max 22, min 0, 442 decoded / 5 dropped frames, with maximum-resolution detection enabled. This is consistent with low input cadence. The root cause (exposure, driver, negotiation, device load, or downstream processing) is **not established**. OV01AS's name alone does not establish which sensor/path Windows used; do not infer infrared selection from FPS alone. The supplied 720p/30 RGB and 360p/15 infrared hardware specifications are not actual delivery measurements.

### Temporary local readiness check

1. Consent, then **Enable camera**. No SDK instance, authentication request, pixel readback, recording, file write, or diagnostic upload occurs during this local check. Camera acquisition and normal live preview necessarily occur in memory. Recording consent applies only after Begin the scene.
2. Enumerate `videoinput` devices after permission; audio inputs are excluded. Keep browser IDs only in memory for selection. Display bounded text labels with control/bidi characters and common USB-ID suffixes removed, never device/group IDs. An infrared/depth label gets a warning; an unclassified label is not certified as RGB.
3. Warm up for one second, then measure four two-second windows using the visible video's **`requestVideoFrameCallback()` / `presentedFrames`** counter and `performance.now()` elapsed time. Count cumulative frame differences (including missed callbacks), include trailing freezes, and cancel when hidden. This measures preview/compositor delivery, not sensor output or native processing throughput. Display the actual track settings separately; `getSettings().frameRate` is a negotiated setting, not a delivered-FPS measurement.
4. The app allows Start SmartSpectra only after all four measured windows reach 25 FPS. Low FPS leaves the preview open for inspection and Stop camera remains available. There is no override to fake readiness. SDK validation, genuine metric freshness and cue thresholds still apply independently.
5. **Stop camera → Refresh cameras → choose device and capture target → Check selected camera**. Explicit selection uses `{deviceId:{exact:id}}`, never silently substitutes another camera when a selected device disappears. Recheck on every new session; selection is temporary and does not persist across app restarts.

The Samsung Galaxy S24 Ultra requires **no Samsung library**: if Windows exposes Microsoft's connected camera as a standard browser video input, it appears in this same list. Its actual label is whatever Windows reports. This implements generic webcam selection; **Samsung hardware and SDK compatibility remain unverified**. If absent, fix Windows connected-camera setup first. If Dell remains slow after one lighting/mode comparison, prioritize the connected phone or another camera.

### Capture configuration and lifecycle

The installed renderer declarations and [Node guide](https://smartspectra.presagetech.com/docs/nodejs/) specify default front-facing **1280×720 / 30 FPS**. Installed `js/renderer/index.js` uses **ideal** width/height/FPS, so default startup can fall back below 30. Cuelira retains that recommended target and offers **640×480 / 30 FPS as a comparison target**, also using ideal constraints. The public `useMediaStream()` accepts host streams with custom resolution. The inspected documentation does **not** certify 640×480 for every metric, publish a universal minimum resolution, or guarantee 30 FPS at that size. Inspect negotiated dimensions and genuine face validation. Prefer 720p if both modes deliver well; use the alternative only if its measured delivery and actual SDK validation work. Do not force exact resolution/FPS or assume separate capability ranges prove a simultaneous supported mode.

The same original stream serves preview, diagnostic and SDK; Cuelira opens no competing camera session. The official SDK internally clones its track for its documented `MediaStreamTrackProcessor`/RGBA/MessagePort path; this clone shares the camera source and the SDK stops it. Cuelira stops all **host-owned** tracks on stop, startup failure, unplug, cancellation (including late getUserMedia resolution), manual fallback and unmount. Source changes require a stopped session. Native stop is awaited and teardown failure requires an app restart.

During capture, the UI also displays **`frameSentThrough(true)` native callbacks per wall-clock second**, sampled every two seconds, separately from the completed pre-SDK preview check. It is not camera FPS, confirmed input throughput, an expression-recognition rate or an SDK readiness verdict. The installed bridge relays native `on_frame`; its exact graph stage and scheduling guarantees are not established by the public Node API. The independent probe separately measures main frame handling, handler time, true/false callbacks and preview delivery during SDK operation. Do not infer a drop percentage or root cause by subtracting these different counters. Negotiated settings are refreshed during capture.

The SDK attempts to lock advertised exposure/white-balance/focus modes after Running, including host streams. Cuelira does not override exposure with undocumented constraints. Brighten the face **before** acquiring/checking the camera, close other camera apps and webcam-test tabs, reduce CPU/GPU work, keep the app visible, and compare modes/devices with optional take recording off. The renderer's RGBA extraction and structured-cloned IPC scale with frame size (720p RGBA is about 3.7 MB/frame); this is a plausible load source, not a proven defect on the Dell.

Installed `js/renderer/timestamp.js` anchors real `VideoFrame.timestamp` values to epoch microseconds and handles monotonicity internally. Cuelira adds no frame pump, artificial timestamp offset, duplicate frame, synthetic camera or SDK-check bypass to production. Diagnostic clocks measure elapsed time only; expression timestamps remain decoded SDK samples. Timestamp errors get separate guidance.

Although the public Node readiness documentation describes `checkDeviceReadiness()`, it is **absent from the installed 3.5.0 renderer declarations and prototype**. Cuelira does not invent a custom interface or reach through the private bridge. This local FPS check is explicitly not Presage's native device-readiness report. Installed API-contract tests enforce that distinction.

### Electron permission correction

The previous uncommitted `"mediaType" in details` / `details.mediaType === "video"` correction is preserved in `electron/camera-policy.ts`, called by the actual Electron handlers. Check and request paths require camera consent, the trusted window at the exact bundled URL, and the main document. Requests allow only a single video media type; audio, mixed media, missing media type, subframes, remote URLs and other permissions are denied. The key remains in main, telemetry remains off, and raw native error messages are not surfaced to the actor. Tests cover the pure policy and actual Electron fake-camera acquisition with consent and denial without consent.

## Decoding without invented values

I consume `metrics.face.expression[]`. Each sample has `stable`, `timestamp` and `scores[]`, with `type` and `confidence`. The [schema](https://smartspectra.presagetech.com/docs/data-types/) defines expression confidence as **0–100**, and timestamps as epoch microseconds. The adapter converts confidence to 0–1 and timestamps to epoch milliseconds; it retains the raw timestamp string and receipt time. It accepts numeric/generated Long timestamps only when safe and valid, picks the latest sample, rejects malformed/duplicate scores, and preserves missing metrics as unavailable.

Validation code `kOk` plus a fresh expression sample is required. A no-face or other warning immediately invalidates recognition. Validation is treated as SDK state, not an assumed periodic heartbeat; expression freshness is checked on every observation. No missing metric is guessed from a camera preview or inferred from a button.

## Platforms and evidence

The inspected SDK supports Windows x64, Apple Silicon macOS and Linux x64/ARM64 (glibc 2.35+), Node 20+ and Electron 28+. I target Windows x64, with Electron 43.8.1. The development machine is Ubuntu 24.04 / WSL2, Node 22.23.1, x64. Native library load and Electron startup were exercised here; no `/dev/video*` is exposed and no key was configured. Compilation is not Windows camera validation.

The decisive acceptance procedure is in [TESTING.md](TESTING.md). **The user reports working Dell and Samsung previews, brief Running, then error 14. Genuine live expression metrics, accepted performed cues, successful Samsung SDK recognition and a real live populated take review remain UNVERIFIED.** Fixture-backed protobuf and state-machine success does not change that status. If surprise or angry is unreliable, inspect real scores and adapt the cue and original script coherently, preserving the neutral transition rule and documenting the change. No such adaptation has been claimed.
