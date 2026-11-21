# Presage support follow-up draft — not sent

We acknowledge Presage's compatibility clarification, supplied by the user: **virtual cameras, including phones through Windows Virtual Camera, are unsupported**. Phone/virtual-camera testing is discontinued. The remaining acceptance test uses a physical built-in or directly connected USB webcam through native `useCamera()`.

**Host:** Dell Latitude 9420, Windows 11 x64; SmartSpectra Node SDK 3.5.0. The private key stays in local configuration. No physical-native expression pass or accepted Cuelira cue has been established yet.

**Earlier evidence, for context only:** the connected-phone browser preview averaged about 29 FPS. Browser-based SDK tests at 720p and 480p failed with validation 11 and error 14. Both copied snapshots were stopped, their main samples 4.9–5.5 seconds old, and the 480p snapshot retained cached 1280×720 dimensions. Those values are not contemporaneous physical-camera measurements and do not locate a specific physical-camera bottleneck. We will not repeat this unsupported route.

**Single physical acceptance test:** `npm run sdk:native` from the normal Windows checkout. It uses an isolated plain Node child, native `SmartSpectraSDK.availableCameras()`, exact `CameraSelection.byId(selectedNativeId)`, and `faceMetrics`, with telemetry and recording off. Known virtual/phone labels are rejected before SDK construction, and other devices require explicit physical-device confirmation and consent. There is no default-device fallback or automatic retry. SDK FPS validation and original timestamps remain unchanged.

**Actual physical result: pending.** Append the final terminal JSON after the one hardware test. It records:

- Sanitized camera names/indices, selection and native discovery status; no opaque IDs.
- The SDK stage, whether start returned, and whether Running was observed.
- Processing/validation/error code counts and metrics/decode counts.
- Distinct scored expressions and genuine fresh/stable/validation-OK expression counts.
- SDK cleanup status and a pass, failure or inconclusive verdict.

No camera frames, raw landmarks, expression categories/confidences, private measurements, absolute timestamps or API key are included. `stopAsync()` and `destroy()` are awaited; a hung worker is terminated with an inconclusive result. SDK-owned capture negotiation is not exposed by the API, so actual resolution/FPS are not invented.

**Deadline decision:** if genuine physical-native expressions arrive with clean cleanup and no SDK errors, integrate only that proven path into the existing rehearsal. If native capture fails on the Dell and no directly connected USB webcam is available, the project is **blocked** and speculative development stops. Any follow-up to Presage should use the actual physical-camera result and its numeric codes, not the earlier virtual-camera snapshots.

This draft has not been emailed or posted. Contact from the official documentation: support@presagetech.com.
