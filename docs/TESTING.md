# Testing and native Windows acceptance

I distinguish automated fixtures, real desktop startup and live camera evidence. No automated result below establishes recognition on a human face.

## Reproduce the automated checks

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:gui
npm run security
npm audit
```

`npm test` covers 36 cases: official protobuf bytes, normalization, percentage scores, safe timestamps, missing/malformed fields, validation, stability, thresholds, arming, sample gaps, stale/future/duplicate events, cooldown behavior, neutral departure/return, manual fallback, pause/recovery, timeout, restart, storage, serialized checkpoints, interrupted-take recovery, export, deletion, recording consent, SDK policy and adapter subscription/teardown. SDK-emitting tests use a declared fixture double; no raw-face recording is bundled.

Four local Playwright tests cover browser manual journey/export/deletion, minimum-window/keyboard/reduced motion, real Electron launch/no-key/persistence/reload/deletion, and a playable WebM recorded from an explicitly synthetic moving canvas. This last test verifies recording code, **not webcam recording**. Native dialogs, real camera denial and real authentication remain separate checks.

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

If already cloned on Windows, pull the existing checkout normally instead of creating another. Obtain a developer key from [Presage](https://physiology.presagetech.com/auth/register). Restart after changing `.env`. For an installed Windows build, place the private `.env` in `%APPDATA%\Cuelira\.env` instead of beside the executable, then restart. Never bake it into the installer. Keep Windows Settings → Privacy & security → Camera → camera and desktop-app access enabled. Close other webcam applications. Use front-facing, even lighting; keep one face in frame.

## Hardware acceptance: all currently NOT TESTED

Record the result of each row as VERIFIED / FAILED / NOT TESTED, with device, OS, date and evidence path. Do not change a status merely because the UI compiles.

| Check                         | Expected evidence                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Launch without consent        | Camera light off; consent unchecked; no preview or recording                                  |
| Grant camera consent          | Enable camera requests the real device; optional recording remains off                        |
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
