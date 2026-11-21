# Testing and native Windows acceptance

## Single direct-native acceptance test

**Presage support clarification supplied by the user:** virtual cameras, including phones through Windows Virtual Camera, are unsupported. Use a physical built-in or directly connected USB webcam with native `useCamera()`. Do not repeat virtual-camera tests.

The earlier browser-probe evidence failed at both 720p and 480p with error 14 and validation 11. Both snapshots were **stopped**, with main samples **4.9–5.5 seconds old**; the 480p report retained cached 1280×720 dimensions. Those are not contemporaneous 480p measurements and do not locate the bottleneck.

Close Cuelira and the browser SDK probe. In the existing **native Windows x64 checkout**, run this single test; keep the private `.env` as it is:

```powershell
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Pull failed; preserve local changes before continuing.' }
npm run sdk:native
```

The terminal lists **SDK-native** camera names and indices only. Select the Dell built-in or directly connected USB webcam index and type **YES** to confirm it is a physical device and consent. If none is available, type **n**; no other camera is selected. Recognizable virtual/phone labels are blocked before SDK construction, independently in both the controller and worker. Other labels are not proof of physical hardware: SDK metadata has no physical/virtual flag, so your explicit confirmation is required. Keep your face toward that physical camera and perform a few deliberate expressions during the 30-second session. The SDK owns capture directly in a plain Node child; there is no Electron renderer, browser MediaStream, frame conversion/IPC pump, frame generator or automatic retry. `CameraSelection.byId()` uses the SDK-discovered opaque ID privately, with SDK camera defaults and no forced constraints. `CameraSelection.default` is verified in the installed API but deliberately not used for an explicitly selected physical-camera test.

Copy the final terminal JSON. It distinguishes native discovery, selected safe name/index, whether `start()` returned, Running observed, capture-phase state/validation/error counts, metrics events, distinct scored expressions, fresh expressions, and fresh/stable/validation-OK expressions. No frame, landmark, category, confidence, ID, key or absolute timestamp is printed or saved. Native log text is suppressed. SDK telemetry is disabled; normal Presage processing disclosures still apply. `stopAsync()` and `destroy()` are awaited. A hung child is terminated by the controller after a bounded timeout, with an **inconclusive** result rather than a pass.

**`PASS_FRESH_VALIDATED_EXPRESSIONS`** requires at least one distinct genuine fresh, stable, scored expression while Running with validation 0, no SDK errors, and completed cleanup. It establishes native expression delivery for that selected device/run, **not** a Cuelira cue or completed rehearsal. Empty/landmark-only packets and Running alone cannot pass. Stale/future timestamps, duplicate samples, unstable samples and validation warnings do not count as validated fresh expressions. If the result passes on the actual physical camera, integrate the smallest proven native path into the existing scene and review. **If native capture fails on the Dell and no directly connected USB webcam is available, stop speculative development and mark the project blocked.** Until then the existing app/scene/recording path is unchanged.

If discovery fails or no physical camera is selectable, the result records that capture was not attempted. If discovered but start/processing fails, the report preserves the stage and numeric codes (11 = low-frame-rate validation, 14 = sustained-low-frame-rate error, 7 = unavailable input). Presage clarified that low-FPS errors can reflect SDK processing throughput, not merely advertised webcam FPS; the earlier Dell browser average of about 10 FPS does not establish the native result. A missing key or timeout is inconclusive, not evidence of a specific hardware defect. Do not switch to another device or silently fall back.

Reference inspected: [Glimra native worker, revision 56a8ccf](https://github.com/0xaje/Glimra/blob/56a8ccf50b89ddc78ad09c0e6bacf66d5881576b/src/main/presageNativeWorker.cjs). It uses a Node child, faceMetrics, native discovery and `useCamera(CameraSelection.default)`; its gesture/landmark logic and automatic recovery were not copied. Landmark success on another session does not establish physical-camera expression success. Public calls and teardown match installed SDK **3.5.0** types.

Automated validation uses explicit protobuf fixtures and a test-only worker SDK double, plus **read-only real SDK discovery** (`npm run sdk:native -- --list-only`) in Linux/Windows CI. Discovery-only never opens a camera or establishes facial recognition. `--build-only` compiles without invoking the SDK. This WSL host exposed no Linux cameras; a read-only Windows SDK attempt through the WSL-shared development folder timed out before discovery returned. No camera capture was requested in that attempt, so it says nothing about physical-camera native success/failure in the normal Windows checkout.

Local validation for this physical-camera correction: type/unused checks, application build, both diagnostic compilations and all **67 unit/integration tests passed**. Seven worker lifecycle cases use an explicitly labeled SDK double only in the test build, covering exact built-in/USB selection, virtual-camera rejection, strict physical confirmation/consent, cleanup and no retry after error 14. The shipping launcher has no simulation option. Real Linux SDK discovery succeeded with no cameras and no capture attempted. The tracked-source security scan found zero findings across 123 files, and `npm audit` reported zero vulnerabilities. The existing scene, recording consent and renderer SDK integration have not been changed or classified as verified. A positive native result still requires the actual Windows physical-camera session and fresh validated stable expressions; an all-zero expression-score vector cannot pass.

GUI regression: five of six cases passed in the full run; the app's native Electron launch timed out at 60 seconds. A focused rerun passed that case in 25.9 seconds, including consent, secure defaults and manual-take persistence/deletion, without code changes. All six cases therefore passed across those runs. Updated camera messages were inspected at 1360- and 960-pixel widths with no clipping. These are automated fixtures, not physical-camera recognition evidence.

The earlier browser-probe investigation is historical and superseded by the support clarification. Its frame counters and source trace remain regression evidence; do not follow its former phone/virtual-camera comparison workflow. [The support draft](PRESAGE_SUPPORT_REPORT.md) is updated and unsent.

The independent probe adds three unit contract/metadata tests (53 total) and one native Electron no-key/fake-camera smoke case (six GUI cases total). Its smoke test verifies sandboxed startup, the hidden credential boundary, consent, cleanup and sanitized report shape, not authenticated recognition. Build the probe before running GUI tests on a clean checkout; `npm run check` and CI do so. The readiness UI's higher-rate canvas fixture is explicitly **synthetic 60 FPS**, giving the test render loop headroom; a nominal 30-FPS timer canvas repeatedly delivered a sub-25 window on this host. This changes no production rate, threshold, timestamp, counter or SDK input. Tests still use measured browser delivery and must pass the unchanged readiness gate; no synthetic fixture establishes Samsung support.

Investigation validation: lint/type checking, the application build, standalone-probe compilation and **53 unit tests passed**. All **six GUI cases passed across split runs**, including the final higher-rate synthetic camera-selection fixture and the independent probe's native Electron smoke case. The latter used an explicitly fake camera and no developer key; no authenticated SDK frame processing or facial recognition was established. The tracked-source security scan reported zero findings across 118 files; whitespace checks passed. The probe screenshot was inspected for readable counters and copyable metadata. The diagnosis remains undetermined pending the real Windows probe results.

I distinguish automated fixtures, real desktop startup and live camera evidence. No automated result below establishes recognition on a human face.

## Reproduce the automated checks

```sh
npm ci
npm run typecheck
npm run lint
npm run build
npm run sdk:probe -- --build-only
npm run sdk:native -- --build-only
npm test
npx playwright install chromium
npm run test:gui
npm run security
npm audit
```

`npm test` covers official protobuf bytes, normalization, percentage scores, safe timestamps, missing/malformed fields, validation, stability, thresholds, arming, sample gaps, stale/future/duplicate events, cooldown behavior, neutral departure/return, manual fallback, pause/recovery, timeout, restart, storage, serialized checkpoints, interrupted-take recovery, export, deletion, recording consent, SDK policy and adapter subscription/teardown. Camera regressions add exact selection, negotiated preferences, safe labels/IR warning, real callback-counter arithmetic, four FPS windows, freezes/no frames, cancellation/visibility, host-stream ownership, late acquisition, device switching, unplugging, native teardown failure and separate error classifications. SDK-emitting tests use a declared fixture double; frame-metadata tests use simulated counters. No raw-face recording is bundled. `lint` is TypeScript's unused-local/parameter check plus normal type checking; no ESLint toolchain is installed.

Five local Playwright tests cover browser manual journey/export/deletion, minimum-window/keyboard/reduced motion, real Electron launch/no-key/persistence/reload/deletion and camera permission handlers using Chromium's explicitly fake camera, camera selection/readiness/cancellation using clearly labeled synthetic Dell/phone canvas fixtures, and playable WebM recording from an explicitly synthetic moving canvas. These verify application code, **not real camera compatibility or facial recognition**. The camera-selection test measures actual browser delivery of its synthetic streams with the production counter. Native save dialogs, actual Windows camera denial and real authentication remain separate checks. Screenshots with `fixture` in the name are automated synthetic evidence only.

Camera-change validation on this development host: **typecheck, lint, build and all 50 unit tests passed**. All **five GUI cases passed across split runs**: the final full-suite process received SIGTERM after the camera-selection, manual journey and minimum-size cases passed; the remaining native Electron and recording cases then passed together with exit code 0. Earlier GUI failures exposed and fixed a duplicate preview-stream attachment/playback race and an incorrect test dropdown locator. The camera check brings the preview into view to avoid measuring off-screen compositor throttling. None of these findings establishes the cause of the user's original Dell low-FPS error.

The tracked-file security scan reported zero findings, and Git whitespace checks passed. Real screenshots of the low-FPS fixture, selected higher-rate fixture, and native Electron fake-camera check were inspected at desktop and 960-pixel widths; no clipping or horizontal overflow was observed. Hallmark's static CSS scan reported zero FAIL/REFLEX/WARN; its render tier did not run, so actual Playwright screenshots provide visual evidence. Diagnostic screenshots stay in ignored `artifacts/screenshots/`, outside source control. Windows camera acceptance remains separate.

On this WSL host I reused existing Chromium installations. Playwright config accepts `PLAYWRIGHT_CHROMIUM_PATH`; a normal installation uses Playwright's downloaded browser. The Electron GUI test uses `--no-sandbox` only for the restricted Linux test host; shipping window settings still specify sandbox and context isolation, and `npm start` adds no such flag. Standard CI skips the Linux Electron display test and runs the browser/recording checks.

[Windows CI run 44661497725](https://github.com/sopskistar/Cuelira/actions/runs/44661497725) passed at revision `1ae9005`: an unsigned NSIS installer was built, the packaged executable launched with its bundled native SDK library, renderer Node globals were absent, and a manual take completed, persisted across reload and deleted. It used no key or camera and no Windows `--no-sandbox` flag. The verification JSON and actual screenshots are attached as **Windows-packaged-app-verification**; the installer is **Cuelira-Windows-unsigned**. I inspected both Windows screenshots. CI cannot certify a camera, performed facial cues, native save dialogs or installer interaction.

## Native Windows: use a separate checkout

Use **Windows PowerShell**, not a WSL terminal, and a local NTFS folder. Do not reuse WSL `node_modules` or native binaries.

```powershell
git clone https://github.com/sopskistar/Cuelira.git
cd Cuelira
node --version
# Node 22 or 24 x64; Electron and the SDK are installed locally below.
npm ci
Copy-Item .env.example .env
notepad .env
# Replace the placeholder privately, save, close the editor. Do not share the key.
npm run build
npm test
npm start
```

If already cloned on Windows, use the update commands below. Obtain a developer key from [Presage](https://physiology.presagetech.com/auth/register). Restart after changing `.env`. For an installed Windows build, place the private `.env` in `%APPDATA%\Cuelira\.env` instead of beside the executable, then restart. Never bake it into the installer. Keep Windows Settings → Privacy & security → Camera → camera and desktop-app access enabled. Close other webcam applications. Use front-facing, even lighting; keep one face in frame.

## Update an existing Windows checkout and retest camera selection

Close Cuelira first. Run in **Windows PowerShell**, in the existing Windows checkout (replace the example folder with its actual location). This preserves an existing private `.env`; do not copy the example over it. If the working tree has local edits, the script stops so they can be committed or preserved before pulling. Do not use `reset --hard`, `clean`, or a WSL checkout.

```powershell
Set-Location 'C:\path\to\Cuelira'
git status --short
if (git status --porcelain) { throw 'Local changes found. Preserve them before pulling.' }
git switch main
if ($LASTEXITCODE -ne 0) { throw 'Could not switch to main' }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Pull failed. Resolve the checkout state before continuing.' }
git rev-parse HEAD
node --version
node -p "process.platform + '-' + process.arch"
# Expected native Windows: win32-x64, Node 22 or 24.
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
npm run security
if ($LASTEXITCODE -ne 0) { throw 'Security scan failed' }
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  notepad .env
  throw 'Add your key privately, save .env, then run npm start.'
}
npm start
```

Optional automated browser fixtures on Windows: `npx playwright install chromium`, then `npm run test:gui -- --grep-invert 'native Electron'`. The local native Electron GUI test is for this Linux development host (uses `--no-sandbox` with a fake camera); packaged Windows smoke tests run in CI with no such flag. These automated fixtures cannot certify Samsung or Dell behavior.

1. Use the single native physical-camera test at the top of this document. Choose the built-in Dell camera or an available directly connected USB webcam, never a phone or virtual camera.
2. A genuine fresh/stable/validated native pass permits the smallest supported integration into the existing rehearsal. Preserve consent, the three cues, Rowan's responses, review and recording protections. Verify real accepted cues before authentic demo capture.
3. If Dell native capture fails and no USB webcam is available, the result is **blocked / no-go**. Keep the sanitized terminal evidence for Presage and stop speculative work. No automatic retry, safety-check bypass or redesign is authorized by a failed test.

For each device/mode, record: commit, Windows version, safe camera label, requested target, negotiated dimensions/FPS, measured average/lowest window, SDK input-callback rate, validation/error code, whether real metrics arrived, accepted cues and optional-recording state. Do not include device IDs, API keys, `.env` contents or unapproved face footage. Diagnostics are temporary and are not added to take exports. Share only evidence you intentionally approve.

## Current hardware evidence

On November 21 the user reported a genuine Dell Latitude 9420 preview, brief Running, no fresh valid expression samples, then error 14. Their independent OV01AS web test reported average 10 / max 22 / min 0 FPS with maximum-resolution detection enabled (442 decoded / 5 dropped). This corroborates low delivered rate; it does not establish its underlying cause or prove infrared selection. Presage has since confirmed that the phone/virtual-camera route is unsupported; do not repeat it. Physical-native expression delivery and accepted live cues remain **UNVERIFIED**. See [the investigation](SMARTSPECTRA_INTEGRATION.md#error-14-investigation-and-camera-selection-november-21-2026).

## Hardware acceptance: repeat on the new camera-selection flow

Record the result of each row as VERIFIED / FAILED / NOT TESTED, with device, OS, date and evidence path. Do not change a status merely because the UI compiles.

| Check                         | Expected evidence                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Launch without consent        | Camera light off; consent unchecked; no preview or recording                                  |
| Grant camera consent          | Enable camera requests the real device and measures FPS; optional recording remains off       |
| Choose Dell / physical USB    | Stop, refresh, select real listed device, check its label/preview/settings/delivered FPS        |
| Low FPS                       | SDK startup disabled; measured result visible; stop and select another camera/mode            |
| OS denies camera              | Useful error; no active capture; manual option remains labeled                                |
| Missing / invalid key         | Missing key errors before capture; invalid key yields SDK error, never Ready                  |
| Authenticated SDK startup     | Setup reports Running and fresh, nonempty facial metrics                                      |
| Real observations             | Label, confidence, stability, validation and changing epoch-microsecond timestamp visible     |
| Correct discovery cue         | After arming, performed surprise is accepted; Rowan admits hiding the message                 |
| Wrong/weak/no-face cue        | Does not advance; usable framing/availability feedback appears                                |
| Confrontation                 | A stable angry observation causes Rowan's second response                                     |
| Neutral guard                 | A neutral face at final entry alone does not pass; perform non-neutral, then release and hold |
| Completion and review         | Three causal `accepted` events include real sample timestamps and confidence/stability        |
| Manual fallback               | A separate run's Continue manually creates `manual`, no fake recognized cue                   |
| Pause / camera loss / restart | No buffered transition; resources stop; retry/resume re-arms safely                           |
| Recording on/off              | Off creates no WebM; separately consented real recording plays and exports                    |
| Exports and deletion          | Open JSON/text/video files; delete take; app files gone, separate exports remain              |
| Packaged Windows app          | Installer launches; native DLL resolves; repeat live cues, stop and close                     |

Capture one uninterrupted screen recording showing consent, SDK startup, facial observations, performed cue → response, remaining beats and review. Keep diagnostics visible enough to inspect; hide all key editors and terminals containing credentials. Export that take's JSON and text report. Include the exact commit SHA (`git rev-parse HEAD`) and platform/device notes. Share only media you intentionally approve for judging.

If no expression scores arrive despite a camera preview, inspect key entitlements and requested face metrics. If stable scores arrive but the selected cue is unreliable, export the failed take, inspect the actual category distribution, and adjust the script/cue or thresholds with a documented reason. Never relabel a manual pass. Do not weaken validation merely to obtain a staged success.

## Visual and accessibility evidence

Real screenshots are generated under ignored `artifacts/screenshots/`. I inspected welcome, consent error, manual stage, review and 960×680 captures. The independent finish review requested persistent controls, a complete preparatory script, accurate pause text and larger status labels; those changes were implemented. Further recapture and verdict are recorded in [FINAL_READINESS.md](FINAL_READINESS.md). Static Hallmark checks report zero FAIL; its render tier was unavailable because Puppeteer was not installed, so Playwright captures provide the visual evidence. No phone/tablet companion is shipped.
