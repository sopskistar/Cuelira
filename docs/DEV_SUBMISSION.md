---
title: "Cuelira: Your scene responds to you"
published: false
tags: devchallenge, presagechallenge, electron, typescript
---

_This is a draft for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04/). Do not publish until genuine camera acceptance and the real demo video are complete._

## What I Built

I built Cuelira, a live self-tape rehearsal partner for an actor working alone.

Cuelira is a live self-tape rehearsal partner that uses Presage SmartSpectra to make scripted scenes respond to an actor's facial expressions and provide take-by-take feedback.

In my original scene, The Last Message, I play Alex opposite Rowan, a person who hid an important message. Three deliberately performed facial cues change the conversation. The take ends with a review of the events that actually moved it forward. Cuelira does not claim to know what I feel or grade my acting.

## Demo

**INCOMPLETE: insert the genuine, inspected live-camera demo here.** The current title-graphics proof is not the required live demonstration. Before publishing, I must provide an authenticated Windows capture showing real metrics, a performed accepted cue, Rowan's corresponding response and the populated review. I will identify every manual continuation and any time skip honestly.

## Code

[Cuelira on GitHub](https://github.com/sopskistar/Cuelira). Native Windows setup and live verification are in README and `docs/TESTING.md`. My existing MIT attribution and genuine development history are preserved.

## How It Responds to Human Signals

I use the official SmartSpectra 3.5.0 main, preload, renderer and messages entry points. I explicitly request `faceMetrics`. The adapter reads expression samples, percentage confidence, stability, SDK validation and microsecond timestamps; missing fields remain unavailable.

My deterministic scene engine requires a fresh matching cue, an arming delay, a sustained stable hold and a cooldown. Wrong, stale, weak, duplicate or invalid observations do not advance the scene. The final neutral cue requires a new non-neutral departure within that beat before a stable return, so an initially neutral face cannot finish it automatically.

An accepted observation advances Rowan's authored response and is attached to the take event. Continue manually creates a different event. Camera loss disarms recognition, and recovery requires retry/resume. No runtime chatbot or paid voice service supplies the partner.

**Evidence note before publication:** the logic and official protobuf contracts have fixture-backed tests; real camera performance is not yet verified. Replace this note with the actual dated acceptance record and its limits, not an unsupported claim.

## Prize Categories

**Most Creative or Delightful Use.** I use deliberate facial-performance cues to change the dramatic partner's response, rather than merely drawing an expression graph.

**Best Thoughtful Real-World Use, conditional on genuine demonstrated usefulness.** I designed a bounded rehearsal for aspiring actors, including emerging Nollywood performers working without a reader. Captions, manual recovery, local review and deletion keep the workflow usable. I will only retain this category claim if my real demonstration supports it. Overall consideration follows the official rules.

## Consent and Data Handling

Camera access requires explicit adult opt-in and Enable camera. Recording has separate consent, is off by default and captures silent video only. Stop camera, ending a take, restarting or closing the app releases capture.

Reports and optional WebM files remain in local app data until deleted. Export creates an independent copy; Delete take removes app-stored files, not exported copies, backups or provider records. No Cuelira analytics, upload server or cloud database is included.

I set `enableTelemetry: false`, but do not claim this disables all SDK communication. Presage's current policy describes authentication, model delivery, usage records and automatic Insights through Presage and Anthropic independently of telemetry. My face-only configuration requests no vitals and sends no Insights prompts; native network traffic has not been independently audited. Provider retention/deletion remains governed by its policy. See my [full disclosure](https://github.com/sopskistar/Cuelira/blob/main/docs/PRIVACY_AND_CONSENT.md) and [Presage's SDK policy tab](https://presagetech.com/legal/privacy-policy).

## Agent Session

I used Codex for research, implementation and checks, with my original product brief and scene direction. If I add a development-session embed, I will curate it, remove credentials/private material and verify the public link before publishing. No session link is fabricated here.
