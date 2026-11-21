# Testing and native Windows acceptance

For the current Samsung preview/SDK discrepancy, use the short independent procedure in [SDK_BLOCKER_DIAGNOSIS.md](SDK_BLOCKER_DIAGNOSIS.md#short-windows-procedure) before any further production camera changes. The probe compares the same Samsung at 720p and 480p, measures preview during SDK operation and main handler timing, and separates true/false native callbacks from input handling. Its copyable report contains metadata only. `frameSentThrough(true)` frequency is not a physical-camera FPS measurement. [The support report](PRESAGE_SUPPORT_REPORT.md) is prepared, not sent.

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

1. Connect the Samsung using Microsoft's Windows connected-camera setup **before** checking the camera list. Follow [Microsoft's official connected-camera instructions](https://support.microsoft.com/en-gb/windows/apps/phonelink/use-your-mobile-device-s-camera). Check Windows Settings → Bluetooth & devices → Mobile devices → Manage devices → the phone's connected-camera setting, where available. Confirm the phone is connected/unlocked and accept its camera prompt. Exact availability depends on Windows/Phone Link setup. No Samsung-specific Cuelira package is required.
2. Close Windows Camera, Teams, Zoom and **all webcam-test tabs** before opening Cuelira. If using WebcamTests separately, disable maximum-resolution detection and record its actual selected mode/FPS; close it again before Cuelira.
3. Start a rehearsal. Leave optional recording **off** for the first test. Grant camera/processing consent and click **Enable camera**. The first check uses the system default; this does not guarantee RGB. Keep the preview visible for the full nine seconds. The app brings it into view when checking. No SDK starts during this check.
4. Inspect the preview, safe device label, actual negotiated dimensions/FPS, measured preview FPS and lowest window. Stop camera, **Refresh cameras**, then select the Samsung's Windows-reported label (or OV01AS for comparison). Select 1280×720/30 and click **Check selected camera**. Device and mode controls stay locked until stop. To choose the Samsung immediately, cancel the first check as soon as labels are listed, then stop/refresh/select.
5. A passing camera check means all four windows reached 25 FPS, with 30 as the target. It is not SDK readiness or recognition proof. If Dell remains slow after adding light and one 640×480 comparison, prioritize the Samsung or another webcam. Lowering resolution is only a comparison; it guarantees neither 30 FPS nor valid SDK metrics. If Samsung is absent, resolve Windows exposure of the camera first; Cuelira cannot select a device Windows does not enumerate.
6. Click **Start SmartSpectra** only after the selected camera passes. Check Running **and** fresh, nonempty, valid expression observations. The completed camera check and the separate SDK input-callback rate remain available in preparation / stage diagnostics. A good camera check followed by low SDK input-callback rate points toward load/exposure/frame-delivery investigation; it is not proof of a specific cause.
7. Begin the scene only when valid fresh face metrics enable it. Perform surprise, angry, then a deliberate non-neutral expression followed by return toward neutral. Verify Rowan responds to genuine **accepted** cues. Complete/review and export the real event report. Repeat with separately consented video recording only after live sensing works, watching for an FPS drop under recording load.
8. Test Stop → select other device → recheck → start; cancel an in-progress check; unplug/disable the phone during capture; reconnect and explicitly retry. Confirm no buffered cue advances after failure, no automatic SDK restart, and the camera indicator goes off on stop/cancel/exit. After failed native teardown, restart Cuelira before another attempt.

For each device/mode, record: commit, Windows version, safe camera label, requested target, negotiated dimensions/FPS, measured average/lowest window, SDK input-callback rate, validation/error code, whether real metrics arrived, accepted cues and optional-recording state. Do not include device IDs, API keys, `.env` contents or unapproved face footage. Diagnostics are temporary and are not added to take exports. Share only evidence you intentionally approve.

## Current hardware evidence

On November 21 the user reported a genuine Dell Latitude 9420 preview, brief Running, no fresh valid expression samples, then error 14. Their independent OV01AS web test reported average 10 / max 22 / min 0 FPS with maximum-resolution detection enabled (442 decoded / 5 dropped). This corroborates low delivered rate; it does not establish its underlying cause or prove infrared selection. Samsung S24 Ultra capture, SDK input and accepted live cues remain **UNVERIFIED**. See [the investigation](SMARTSPECTRA_INTEGRATION.md#error-14-investigation-and-camera-selection-november-21-2026).

## Hardware acceptance: repeat on the new camera-selection flow

Record the result of each row as VERIFIED / FAILED / NOT TESTED, with device, OS, date and evidence path. Do not change a status merely because the UI compiles.

| Check                         | Expected evidence                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Launch without consent        | Camera light off; consent unchecked; no preview or recording                                  |
| Grant camera consent          | Enable camera requests the real device and measures FPS; optional recording remains off       |
| Choose Dell / Samsung         | Stop, refresh, select real listed device, check its label/preview/settings/delivered FPS        |
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
