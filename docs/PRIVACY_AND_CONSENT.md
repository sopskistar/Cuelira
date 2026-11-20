# Privacy and consent

I built Cuelira for consenting adults rehearsing their own performance. I do not use it to infer internal feelings, honesty, personality, mental health or acting ability.

## Before capture

Camera access begins only after an unchecked consent box and Enable camera. The consent text includes Presage processing, separate optional recording, retention, deletion and the provider-policy link. The app requests video only. Recording starts only when a take begins with its separate checkbox selected. It is off by default and silent: no microphone, voice cloning or speech-to-text service. Manual practice starts no camera and makes no SDK-recognition claim.

Pause suspends scene recognition but leaves capture on, disclosed in the UI. Stop camera stops tracks and the SDK. Ending a take, restarting or closing the window releases capture. Camera-loss recovery disarms the scene and requires retry/resume. No hidden background sensing or third-party app analytics is included.

## Local storage and retention

| Data                                          | Location and retention                                                                                                        | Deletion                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Live frames                                   | SDK/preview memory; not app-stored unless optional recording is enabled                                                       | Stop capture / close app                                                                |
| Scene events and sampled expression summaries | Electron `userData/takes/<uuid>.json`, until deleted; includes capture/receipt times, label, scores, stability and validation | Delete take removes app-stored JSON                                                     |
| Optional silent video                         | Same directory, `<uuid>.webm`; in memory until normal save, then retained until deleted                                       | Delete take removes app-stored WebM                                                     |
| Exports                                       | A path chosen in the native save dialog                                                                                       | Delete each exported copy separately                                                    |
| Developer credential                          | Private environment or `.env`, never included in reports                                                                      | Remove local config; revoke at Presage separately                                       |
| SDK/device cache and Chromium profile         | OS/app cache, distinct from take files; SDK-managed retention                                                                 | Quit first; remove deliberately, understanding other SDK hosts may share fallback cache |

The exact take directory appears in setup and My takes. Normally Windows uses `%APPDATA%\Cuelira\takes`; Linux uses `~/.config/Cuelira/takes`. OS configuration can change these paths. Reports checkpoint every five seconds. An abrupt exit may lose recent events and unfinished video. Deletion is normal filesystem unlink, not guaranteed forensic erasure, and does not remove exported copies or backups. I do not automatically upload private recordings.

## Presage's processing: telemetry is only one part

I verified `enableTelemetry: false` in renderer configuration, enforced main configuration and fixture tests. According to the [telemetry documentation](https://smartspectra.presagetech.com/docs/telemetry-and-privacy), this disables optional session/readiness telemetry. Cuelira does not invoke device-readiness checks. With telemetry enabled, reports can be associated with authenticated accounts; they are not categorically anonymous. That page also says diagnostic storage has no automatic expiration configured.

The **SmartSpectra SDK Privacy Policy**, effective 3 November 2026, is a separate tab on [Presage's current policy page](https://presagetech.com/legal/privacy-policy). It states that images and face-derived data stay on the device, while authentication/model-delivery requests and usage records reach Presage. Sections 4 and 7 describe automatic Insights, including measurements processed through Presage and Anthropic, independently of telemetry. Section 10 specifies provider retention by record type; local deletion does not delete provider-held records. Provider deletion requests go through the policy's contact process. I cannot promise a deletion deadline across the telemetry and broader-policy documents.

Cuelira requests only face metrics and sends no Insights prompts. The [Node Insights guide](https://smartspectra.presagetech.com/docs/nodejs/llm-insights) describes automatic Insights with breathing/cardio and a stable pulse, none of which I request. **I have not independently audited native network traffic** and do not assume the face-only configuration overrides the broader provider policy. The consent screen discloses that policy. Telemetry-off does not mean offline, no usage records or no external processing.

The older `api.physiology.presagetech.com/privacypolicy` linked from the docs returned a policy dated February 2024. I found the current SDK-specific policy through the main Presage legal page and use that link in-app. This mismatch is recorded rather than silently treating the older page as current.

## Secrets and distribution

The key remains in main memory and is not returned through the preload API or compiled into renderer assets. Desktop credentials cannot be made invulnerable to someone who controls the computer; a shared developer key should not be embedded in a public installer. Judges supply their own developer key locally. Files use restrictive POSIX modes where available; Windows relies on account/profile permissions. Protect the machine, account, exports and backups accordingly.
