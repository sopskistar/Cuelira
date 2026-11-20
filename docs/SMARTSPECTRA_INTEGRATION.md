# SmartSpectra integration and live verification

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

The renderer imports from `/renderer`, which acquires the camera on `start()` and emits `streamAvailable`. Main calls `bindSmartSpectraIpc(window)` from `/main`; the sandboxed preload incorporates the official `/preload` script without changing it. The [official messages decoder](https://smartspectra.presagetech.com/docs/nodejs/api-reference) decodes metrics buffers. No `electron-rebuild`, `node-gyp`, custom native input loop or browser-only SDK is introduced.

`faceMetrics` is `[11,12,13,14]`: landmarks, blinking, talking and expressions. The scene uses expressions; the other bundle members are not retained in take reports. The default SDK breathing bundle would not satisfy this product, so the face bundle is explicit in both renderer and main policy.

## Private credential boundary

`PRESAGE_API_KEY` (or `SMARTSPECTRA_API_KEY`) is read in main from the environment or the private local `.env`. No credential getter is exposed. The official bridge currently expects configuration on `smartspectra:attach` and has no main-only key injection option. Using Electron's public `ipcMain.prependListener` and `MessagePortMain.prependListener`, I apply a small policy before the official listener: inject the private key, force face metrics, disable telemetry, reject capture messages without consent and block insights. I do not fork the SDK or invoke its hidden native methods.

This is a **version-pinned transport policy**, not a promised upstream extension API. `tests/sdk.test.ts` checks the installed version, bundle and wire strings; `tests/storage.test.ts` checks policy behavior. Port-listener ordering and a successful live start with a real credential still need Windows acceptance. The app catches native-load failure and disables genuine capture rather than pretending it succeeded. A future upstream credential callback would be preferable.

## Decoding without invented values

I consume `metrics.face.expression[]`. Each sample has `stable`, `timestamp` and `scores[]`, with `type` and `confidence`. The [schema](https://smartspectra.presagetech.com/docs/data-types/) defines expression confidence as **0–100**, and timestamps as epoch microseconds. The adapter converts confidence to 0–1 and timestamps to epoch milliseconds; it retains the raw timestamp string and receipt time. It accepts numeric/generated Long timestamps only when safe and valid, picks the latest sample, rejects malformed/duplicate scores, and preserves missing metrics as unavailable.

Validation code `kOk` plus a fresh expression sample is required. A no-face or other warning immediately invalidates recognition. Validation is treated as SDK state, not an assumed periodic heartbeat; expression freshness is checked on every observation. No missing metric is guessed from a camera preview or inferred from a button.

## Platforms and evidence

The inspected SDK supports Windows x64, Apple Silicon macOS and Linux x64/ARM64 (glibc 2.35+), Node 20+ and Electron 28+. I target Windows x64, with Electron 43.8.1. The development machine is Ubuntu 24.04 / WSL2, Node 22.23.1, x64. Native library load and Electron startup were exercised here; no `/dev/video*` is exposed and no key was configured. Compilation is not Windows camera validation.

The decisive acceptance procedure is in [TESTING.md](TESTING.md). **Genuine camera initialization, authenticated live metrics, performed cues and a real populated take review are NOT TESTED.** Fixture-backed protobuf and state-machine success does not change that status. If surprise or angry is unreliable, I must inspect real scores and adapt the cue and original script coherently, preserving the neutral transition rule and documenting the change. No such adaptation has been claimed.
