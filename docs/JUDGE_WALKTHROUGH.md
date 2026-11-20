# Thirty-second repository check

I make the proof path short, while keeping its present limits visible.

1. Read the README description and status: the current screenshot is a real app capture, with no live-camera claim. The final genuine demo is not yet supplied.
2. Inspect [`src/sdk/live.ts`](../src/sdk/live.ts): official `/renderer`, explicit `faceMetrics`, telemetry off, metrics/validation/error subscriptions and stop lifecycle.
3. Inspect [`electron/main.ts`](../electron/main.ts) and [`electron/sdk-policy.ts`](../electron/sdk-policy.ts): official `/main` and preload, main-only credential injection, consent and restricted IPC.
4. Follow [`normalize.ts`](../src/core/normalize.ts) → [`engine.ts`](../src/core/engine.ts): percentage/timestamp normalization, arming, rejection, sustained cues and neutral return. `accepted` always retains its observation; `manual` does not impersonate recognition.
5. Run `npm ci`, `npm run build`, `npm test`; use the Windows procedure in [TESTING.md](TESTING.md) for live proof. No login, payment or cloud account is added by Cuelira; a private Presage developer key and provider authentication are required.

In the app, a completed take shows three transitions, their source, timestamps, observed cue/confidence/stability and the full event report. Manual practice can verify the authored journey and exports immediately, but it cannot demonstrate the required live sponsor signal. The decisive evidence must be an actual performed cue and its accepted event visible with Rowan's response in the final video.

Privacy, limitations and acceptance status are linked directly from README. I welcome inspection of what works and what remains unverified; the project does not imply psychological or artistic judgments.
