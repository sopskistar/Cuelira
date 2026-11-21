# Historical SDK blocker investigation

**Superseded:** Presage support has confirmed (as supplied by the user) that virtual cameras, including connected phones, are unsupported. Do not repeat phone/virtual-camera tests. The current action is the [single native physical-camera acceptance test](TESTING.md#single-direct-native-acceptance-test). A physical-native pass permits integration; Dell failure without an available USB webcam means blocked. The material below records the earlier investigation, not a current recommendation.

**Classification: still undetermined.** There is no verified throughput fix yet. The new evidence rules out “the selected Samsung preview cannot deliver 30 FPS” as the explanation for the pre-SDK check. It does not identify the failing stage after SDK start, and a five-per-second native callback count is not itself a five-FPS camera measurement. No production capture architecture, SDK file, frame timestamp, cue threshold or validation check was changed in this investigation.

## Genuine evidence supplied by the user

The user transcribed these measurements from their genuine Windows recording; the recording was not independently viewed in this development environment:

| Item | Observation |
| --- | --- |
| Host | Dell Latitude 9420, Windows 11 |
| Selected source | Samsung S24 Ultra (Windows Virtual Camera) |
| Negotiated browser mode | 1280 × 720, 30 FPS |
| Measured preview before SDK start | 29.3 FPS; lowest window 29.0; all four passed |
| SmartSpectra status | Briefly Running |
| `frameSentThrough(true)` delivery to renderer | Initially zero, then approximately five callbacks/sec |
| Expression metrics | No valid fresh samples |
| Terminal error | `kSustainedLowFrameRate` (14) |

The Samsung preview is working according to this evidence. Windows permissions, driver reinstalls and another webcam are not the proposed next steps. The missing evidence is **simultaneous preview delivery during SDK operation, main-side frame handling rate/time, true and false callback counts, and a reduced-host comparison**.

## Installed SDK 3.5.0 path

Inspected the installed `@smartspectra/node-sdk` JavaScript and declarations, rather than guessing an API:

1. `js/renderer/index.js`: `start()` clones the host stream's video track for `MediaStreamTrackProcessor`. It shares the camera source with preview; Cuelira does not open a second getUserMedia session. The serial frame loop awaits a real VideoFrame, calls OffscreenCanvas `drawImage()` and **synchronous `getImageData()`** for RGBA pixels, calls the official preload bridge, and closes the VideoFrame in `finally`.
2. `js/preload/index.js`: the contextBridge function passes the frame message to a MessagePort using **structured clone**, without an ArrayBuffer transfer list. The package explicitly documents its MessagePortMain transfer-list limitation. Cuelira does not change that path or enable a private zero-copy interface. Electron documents that contextBridge function arguments are copied across contexts; this is another boundary to consider, not a measured cause.
3. `js/main/index.js`: receives each `kind: 'frame'`, validates shape and calls **synchronous `sdk.sendFrame(Buffer.from(data.buffer), …)`**. Buffer.from(ArrayBuffer) creates a view at this point, not an additional deliberate JavaScript pixel copy. The C++ CustomInput contract says pixels are consumed/copied synchronously before Send returns. Main handler duration may include native copies, locking or other native work; it is not automatically inference duration. The official main bridge catches frame submission errors, drops the affected frame, and rate-limits warnings.
4. `js/ffi.js`: `Session.sendFrame()` calls `smartspectra_session_send_frame`; nonzero return codes throw, otherwise JavaScript returns `true`. This return is **not** `frameSentThrough`.
5. Separately, native `smartspectra_on_frame(handle, sent, timestamp_us)` is wrapped as `sent !== 0`, marshalled from native worker threads onto the main V8 event loop by koffi, emitted as `frameSentThrough`, posted through the port, and emitted again in the renderer. Cuelira's existing display counts only callbacks whose boolean is true over elapsed wall time.

**Verified semantics boundary:** the display measures arrivals of native callbacks with a true flag. It is neither the preview counter, the number of renderer frames extracted, the number of main frame handlers, nor the synchronous sendFrame success count. Public Node/C++ docs and the shipped binding do not specify exactly which native graph stage produces this callback, whether it is decimated, or a one-callback-per-camera-frame guarantee. Native graph source/headers are not in the inspected npm binding/public source tree. Presage must clarify that remaining semantic detail. Cuelira must not derive physical FPS, exact drop percentage, or a root cause from this counter alone.

The official timestamp anchor is left unchanged. The diagnostic reads timestamp **differences** only; it never changes or substitutes timestamps. The existing pre-SDK preview check measures composition before conversion/SDK load. A cloned track's processor can encounter different queue pressure from the preview consumer. The [W3C processing draft](https://www.w3.org/TR/mediacapture-transform/) describes bounded queues and frame discard; it does not establish that this happened on the user's Windows run.

## Quickstart comparison and contention

Compared Presage's public quickstart at revision **`90f0cbb4018362ddf5e1a6c3ae2875e92e41861e`**: [main.js](https://github.com/Presage-Security/SmartSpectra/blob/90f0cbb4018362ddf5e1a6c3ae2875e92e41861e/nodejs/samples/electron-quickstart/main.js), [renderer.js](https://github.com/Presage-Security/SmartSpectra/blob/90f0cbb4018362ddf5e1a6c3ae2875e92e41861e/nodejs/samples/electron-quickstart/renderer.js), [README](https://github.com/Presage-Security/SmartSpectra/blob/90f0cbb4018362ddf5e1a6c3ae2875e92e41861e/nodejs/samples/electron-quickstart/README.md).

Both use the same `/renderer`, `/preload`, `/main` modules and sandbox/context isolation. The quickstart defaults to SDK-owned camera acquisition, requests breathing plus optional cardio/face, draws charts, and demonstrates a renderer API-key constant. Cuelira uses the documented `useMediaStream()` for an explicitly selected host camera, face-only metrics, telemetry off, no accumulated output, and a pinned main-side credential injection boundary. The SDK's conversion and transport are shared. The quickstart package uses `latest`; this probe intentionally keeps **3.5.0** and Electron **43.8.1** to avoid changing two variables.

Cuelira's preparation screen redraws every 150 ms and displays status/metrics in React. That shares renderer-thread time with pixel extraction and bridge calls, so contention is possible. At the reported pre-take failure, the optional recorder has not started and stage-only take checkpointing is not running. Cuelira's expression freshness and cue checks are downstream of metrics and do not control SDK frame submission or directly emit native error 14; weakening them would not address this native frame-rate error. No intentional five-FPS throttle, custom frame generator, Cuelira pixel conversion or repeated capture session was found. Source inspection does not prove UI contention is absent; that is the point of the independent probe.

## Independent test: `npm run sdk:probe`

The probe is a small standalone diagnostic host under `tools/sdk-probe`, built into ignored `artifacts/sdk-probe`. It does **not** import Cuelira's LiveCapture, React, rehearsal engine, recorder, storage, normalization or production main/preload. It reuses the installed SDK's capture/conversion/IPC lifecycle unchanged. Only essential consent/security, a selected real browser stream, face metrics and a main-only private credential shim are retained. It is a reduced equivalent of the official quickstart, **not an unmodified vendor sample**; the shared pinned credential/port assumption is a remaining common factor.

The probe exposes separate two-second windows:

| Measurement | Meaning and limits |
| --- | --- |
| `previewFps` | Visible compositor delivery **while the SDK runs**, not just before startup |
| `mainFramesHandledPerSecond` | Real SDK frame messages whose main listener executes; does not measure queued-but-unhandled messages or prove native processing |
| `timestampCadenceFps` / gaps / ordering | Cadence of original SDK frame-message timestamps in this window; does not modify them or prove sensor cadence |
| Handler mean/max ms | An observer before/after the unchanged official synchronous frame handler; includes sendFrame work, not async graph completion |
| `payloadMiBPerSecond` | Size of the frame buffers handled, without reading their pixels or retaining them |
| Main loop delay / renderer long tasks | Evidence of event-loop stalls; renderer long tasks are reported unavailable when unsupported |
| True **and** false native callback rates | Native callback delivery, explicitly not camera FPS |
| Metrics / expression / validated fresh sample counts | Official protobuf decoding; fresh/stable/validation-OK sample counts are not accepted Cuelira cues or calibrated acting results |
| `dropWarnings` | Count of rate-limited official drop-warning messages, **not total dropped frames**; raw log text is suppressed |

Main and renderer windows are asynchronous and separately timed; compare several settled windows, not a startup zero or an assumed exact frame-by-frame join. Windows containing startup/stop are flagged; a partial final window must not be treated as steady-state low FPS. Main sample age exposes stale reports. The probe uses a separate SDK cache namespace and a smaller preview, so cold-start/cache and presentation load are additional comparison variables. The preview's display size does not resize or replace the stream sent to the SDK. Only bounded numeric metadata, enum codes, runtime versions and a safe camera label remain in memory. No diagnostic frame, raw protobuf, absolute frame timestamp, device/group ID, credential, automatic file output or upload is included in the copyable report. Normal SDK authentication/processing disclosures still apply.

The optional **`npm run sdk:probe -- --baseline`** mode removes the main per-frame timing observer and main loop monitor while retaining the same SDK, credential/consent boundary, preview and public SDK callbacks. Use it only if the observer-enabled probe behaves differently; it controls for instrumentation overhead. It cannot report main frame timings.

### Current Windows procedure

Use the [physical-camera native acceptance test](TESTING.md#single-direct-native-acceptance-test). The previous Samsung 720p/480p comparison procedure has been withdrawn following Presage's compatibility clarification.

### Interpretation before any production change

| Observation | Supported conclusion / next action |
| --- | --- |
| Probe produces stable valid expressions at 720p while Cuelira fails under matching conditions | Cuelira-specific integration/UI workload becomes the leading lead; reproduce back-to-back before blaming a single function |
| Preview stays near 30, main handles far fewer frames, synchronous handler is slow | Main synchronous submission/event-loop path is a bottleneck candidate; inspect timings and drops with Presage |
| Preview stays near 30, main handles few frames, handler is fast, renderer has long tasks | Renderer extraction/bridge delivery is a candidate; cannot separate conversion, bridge copy and scheduling without further profiling |
| Main handles near 30 but true callbacks remain near 5 | The old callback counter does not establish five-FPS input; examine false callbacks, validation, metrics and native callback semantics with Presage |
| Preview itself drops only when SDK starts | SDK-induced load or camera parameter changes are candidates; the pre-SDK test did not measure this interval |
| Only 480p improves real main rate **and** supplies valid expressions | A supported browser-capture workaround becomes evidenced; then retest real accepted cues in Cuelira at that mode |
| Both resolutions fail in the reduced host | The rehearsal UI is not required to reproduce it; SDK path / Windows virtual-camera interaction remain to be separated |

## 480p and main-process capture

At 720p RGBA is **3,686,400 bytes/frame**, about **105.5 MiB/sec at 30 FPS** for each full-buffer copy. At 640×480 it is **1,228,800 bytes/frame**, about **35.2 MiB/sec**. That is one third the pixel payload, **not a promised threefold speedup**. The documented host-stream API permits custom resolution. The public face-analysis model description does not specify a universal minimum resolution or certify 480p expression equivalence. Therefore a higher main message rate alone is insufficient: require genuine, fresh, stable, validation-OK expression samples and then the three real accepted Cuelira cues at the actual negotiated size. The user has not supplied this comparison yet.

Main-process capture is a **documented alternative**: the installed public main SDK exposes `SmartSpectraSDK.availableCameras()`, `CameraSelection.byId(nativeId)` and `useCamera(selection,{width,height,fps})`. This bypasses browser extraction and renderer→main raw-frame IPC. Browser device IDs must never be reused as native IDs; the current test must select a physical built-in or USB camera, since virtual/phone inputs are unsupported. Neither `desktopCapturer` nor an offscreen renderer is automatically a physical-camera replacement or a proven latency fix. No architecture migration was made. Only consider it after the reduced-host result, native discovery on the user's machine, valid expressions and a measured throughput comparison justify it.

## Status and sources

**Remaining blocker: undetermined among Cuelira-specific workload/integration, the SDK's renderer/main/native path, and a Windows Virtual Camera interaction.** Samsung's working preview is user evidence; no accepted live cue or authenticated independent-probe result has been observed here. WSL has no exposed real camera or developer credential. Automated fixtures cannot settle this classification.

Sources: installed SDK 3.5.0 declarations and `js/{renderer,preload,main}/index.js`, `js/{smartspectra,ffi}.js`; [Node API](https://smartspectra.presagetech.com/docs/nodejs/api-reference), [Node performance notes](https://smartspectra.presagetech.com/docs/nodejs/), [C++ input/callback reference](https://github.com/Presage-Security/SmartSpectra/blob/90f0cbb4018362ddf5e1a6c3ae2875e92e41861e/cpp/docs/api-reference.md), [face-analysis limitations](https://smartspectra.presagetech.com/docs/model-cards-and-limitations/#face-analysis), [Electron bridge copying](https://www.electronjs.org/docs/latest/api/context-bridge#parameter--error--return-type-support). A ready-to-send, unsent support report is in [PRESAGE_SUPPORT_REPORT.md](PRESAGE_SUPPORT_REPORT.md).
