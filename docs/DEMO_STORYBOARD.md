# Demo plan and capture instructions

I am preparing a 90-second, 1920×1080, 30 fps demo. **The final live demonstration is INCOMPLETE.** No human performance, measured face or authentic SDK result has been fabricated. The six-second `video/render/cuelira-brand-proof.mp4` is original title graphics only, clearly labeled; it is not a competition demo.

## Authored edit

| Time   | Picture                                   | Narration / purpose                                                                                                               |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 0–5s   | Cuelira original intro                    | “Cuelira. Your scene responds to you.”                                                                                            |
| 5–10s  | Concise problem title                     | “When I rehearse alone, a recorded line cannot respond to my performance.”                                                        |
| 10–80s | Genuine continuous Windows screen capture | Consent, SDK startup, observed cue and corresponding response, remaining beats and real take review. Let the performance breathe. |
| 80–85s | Inspectable source paths                  | “The observation, validation and scene transition are inspectable in the repository.”                                             |
| 85–90s | Original outro and repository             | “One scene. My choices. A take I can learn from. Cuelira.”                                                                        |

The editable `video/src/index.tsx` uses named sequences for titles, footage and captions. Placeholder footage is visibly identified; `scripts/video.mjs render` refuses final rendering unless `video/manifest.json` identifies genuinely verified footage and evidence. This gate is a workflow guard, not a hardware certification system.

## What I need to capture on Windows

1. Complete [the hardware checklist](TESTING.md) first, including rejection and the final neutral guard.
2. Use OBS Studio, Windows capture or another existing free recorder at 1920×1080 / 30 fps. Record the entire app, webcam preview, captions, diagnostic fields and the response in one frame. Keep key editors, credentials, notifications and unrelated windows out of view.
3. Keep the first pass uncut: welcome → consent → Enable camera → fresh SmartSpectra metrics → begin → perform surprise → accepted response → angry → accepted response → new non-neutral then neutral → closing line → finish → review.
4. Export the actual take JSON and text report. Record the commit SHA, OS, camera model, date, lighting and any manual action. A passing sponsor-proof take must show actual `accepted` observations; an all-manual take cannot be used as live proof.
5. Separately capture manual fallback, camera denial/loss and optional real video playback/export. These can be short cutaways or evidence attachments if they do not fit the 90-second edit.
6. Supply a clean narration recording if desired. In-app take video is silent and does not capture the screen or partner captions, so it cannot replace the screen recording.

Place approved raw footage in ignored `video/footage/live-take.mp4`. The authored live segment currently needs at least 70 seconds. Actual startup may take longer; retain the raw proof and trim/retime the edit honestly, labeling time skips rather than fabricating results. Retiming captions is required after inspecting the genuine footage. The supplied caption timings are editorial positions, not asserted times of observed cues.

## Production commands

```sh
npm run assets
npm run video:studio   # http://localhost:3100
npm run video:proof    # title graphics only
# After genuine acceptance + footage review + manifest update:
npm run video:render
```

The script reuses `~/hackathon-video-studio/node_modules` locally when present, via an ignored link; `CUELIRA_VIDEO_STUDIO` can point to that existing workspace. Otherwise run `npm install` inside `video/`, whose runtime dependencies are declared separately. It does not overwrite the shared source or replace its dependencies. Generated copies of original assets/fonts and footage links are ignored. Remotion's own renderer browser is used.

## Final inspection before claiming a demo exists

Watch the complete MP4 and verify cue-to-response causality, sync, caption timing, cropping, readable diagnostics, honest manual labels, and no credential exposure. Check with `ffprobe` for H.264, 1920×1080, 30 fps and intended duration. Confirm all audio streams, listen through headphones, and adjust narration around -16 LUFS with peaks below -1 dBTP if audio is added. No stock music is required. Export readable English captions; the narration draft is [video/narration.srt](../video/narration.srt). Upload only after reviewing approved footage. Add the real video link to README and DEV draft; do not substitute the brand proof.
