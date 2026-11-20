import {
  scene,
  thresholds,
  type Take,
  type Observation,
  type Phase,
  type TakeEvent,
} from "./model";

export class Rehearsal {
  phase: Phase = "ready";
  beat = 0;
  enteredAt = 0;
  armed = false;
  hint = "Ready when you are.";
  take: Take;
  private heldSince: number | null = null;
  private departureSince: number | null = null;
  private departed = false;
  private lastCapture = 0;
  private lastAccepted = -Infinity;
  private timedOut = false;
  private lastLogAt = 0;
  private unavailableLogged = false;
  constructor(
    recordingConsent = false,
    config = thresholds,
    id = crypto.randomUUID(),
  ) {
    this.take = {
      schema: 1,
      id,
      scene: "The Last Message",
      mode: "live",
      startedAt: 0,
      status: "rehearsing",
      recordingConsent,
      recordingSaved: false,
      sdkVersion: "3.5.0",
      thresholds: { ...config },
      events: [],
    };
  }
  private log(
    type: TakeEvent["type"],
    at: number,
    detail: string,
    observation?: Observation,
  ) {
    if (type === "observation" && this.take.events.length > 9000) return;
    this.take.events.push({
      type,
      at,
      beat: this.beat,
      detail,
      ...(observation ? { observation } : {}),
    });
  }
  start(at: number) {
    if (this.phase !== "ready") return;
    this.phase = "rehearsing";
    this.take.startedAt = at;
    this.enter(at);
    this.log(
      "started",
      at,
      "Live rehearsal started; thresholds are provisional, pending hardware calibration.",
    );
  }
  private enter(at: number) {
    this.enteredAt = at;
    this.armed = false;
    this.heldSince = null;
    this.departureSince = null;
    this.departed = false;
    this.timedOut = false;
    this.lastCapture = at;
    this.unavailableLogged = false;
    this.hint = "Read the lines. The cue will arm shortly.";
  }
  tick(at: number) {
    if (this.phase !== "rehearsing") return;
    if (
      !this.armed &&
      at - this.enteredAt >= this.take.thresholds.armDelayMs &&
      at - this.lastAccepted >= this.take.thresholds.cooldownMs
    ) {
      this.armed = true;
      this.log("armed", at, `Armed ${scene[this.beat].cue} cue.`);
      this.hint = "Perform the cue and hold it briefly.";
    }
    if (at - this.enteredAt >= 35000 && !this.timedOut) {
      this.timedOut = true;
      this.heldSince = null;
      this.log(
        "timeout",
        at,
        "Cue not accepted within 35 seconds. Reframe or continue manually.",
      );
      this.hint = "Still waiting. Reframe, pause, or continue manually.";
    }
    if (
      this.lastCapture &&
      at - this.lastCapture > this.take.thresholds.maxAgeMs
    ) {
      this.heldSince = null;
      this.departureSince = null;
      this.hint = "No fresh observation. Check camera and lighting.";
      if (!this.unavailableLogged && this.take.mode === "live") {
        this.unavailableLogged = true;
        this.log(
          "unavailable",
          at,
          "No fresh SDK expression sample within the freshness window; no measurement was inferred.",
        );
      }
    }
  }
  observe(o: Observation, now: number) {
    if (this.phase !== "rehearsing" || this.take.mode !== "live") return;
    this.tick(now);
    const c = this.take.thresholds;
    if (now - this.lastLogAt >= 250) {
      this.log("observation", now, o.reason ?? "Observed facial expression", o);
      this.lastLogAt = now;
    }
    if (
      o.capturedAt <= this.lastCapture ||
      o.capturedAt < this.enteredAt ||
      now - o.capturedAt > c.maxAgeMs ||
      o.capturedAt - now > 200 ||
      now - o.receivedAt > c.maxAgeMs ||
      o.receivedAt - now > 200
    ) {
      this.heldSince = null;
      this.departureSince = null;
      this.hint = "Waiting for a fresh, ordered observation.";
      return;
    }
    const gap = o.capturedAt - this.lastCapture;
    this.lastCapture = o.capturedAt;
    this.unavailableLogged = false;
    if (gap > c.maxGapMs) {
      this.heldSince = null;
      this.departureSince = null;
    }
    if (
      o.source !== "presage-smartspectra" ||
      o.face !== "available" ||
      o.validationCode !== 0 ||
      o.reason ||
      !o.stable ||
      o.probability === null ||
      o.probability < c.probability
    ) {
      this.heldSince = null;
      this.departureSince = null;
      this.hint = o.reason ?? "Hold a clearer, stable cue in frame.";
      return;
    }
    // A pre-scene neutral face cannot satisfy the return. Require an explicit
    // stable departure AFTER entry into the final beat, even after manual advancement.
    if (scene[this.beat].cue === "neutral" && o.expression !== "neutral") {
      this.departureSince ??= o.capturedAt;
      if (o.capturedAt - this.departureSince >= 300) this.departed = true;
    } else this.departureSince = null;
    if (!this.armed) return;
    if (scene[this.beat].cue === "neutral" && !this.departed) {
      this.heldSince = null;
      this.hint =
        "First hold a non-neutral expression, then release toward neutral.";
      return;
    }
    if (o.expression !== scene[this.beat].cue) {
      this.heldSince = null;
      this.hint = `Waiting for the ${scene[this.beat].cue} cue.`;
      return;
    }
    this.heldSince ??= o.capturedAt;
    this.hint = "Cue observed. Hold for a moment…";
    if (o.capturedAt - this.heldSince >= c.holdMs) {
      this.log(
        "accepted",
        now,
        `Scene transition triggered by accepted SDK observation: ${o.expression}.`,
        o,
      );
      this.lastAccepted = now;
      this.advance(now);
    }
  }
  manual(at: number) {
    if (this.phase !== "rehearsing") return;
    this.log(
      "manual",
      at,
      "Actor continued manually. This is not facial-cue recognition.",
    );
    this.advance(at);
  }
  private advance(at: number) {
    if (this.beat === scene.length - 1) {
      this.phase = "completed";
      this.take.status = "completed";
      this.take.endedAt = at;
      this.log(
        "completed",
        at,
        "All three beats completed. Read the closing line.",
      );
    } else {
      this.beat++;
      this.enter(at);
    }
  }
  pause(at: number) {
    if (this.phase === "rehearsing") {
      this.phase = "paused";
      this.heldSince = null;
      this.log("paused", at, "Scene paused; camera remains on.");
    }
  }
  resume(at: number) {
    if (this.phase === "paused") {
      this.phase = "rehearsing";
      this.enter(at);
      this.log(
        "resumed",
        at,
        "Cue re-arms with a fresh entry and neutral departure requirement.",
      );
    }
  }
  fail(at: number, message: string) {
    if (["rehearsing", "paused"].includes(this.phase)) {
      this.phase = "error";
      this.heldSince = null;
      this.log("error", at, message);
    }
  }
  recover(at: number) {
    if (this.phase === "error") {
      this.phase = "paused";
      this.hint = "Camera recovered. Resume to re-arm the current beat.";
      this.log("paused", at, "Camera recovered; explicit resume required.");
    }
  }
  stop(at: number) {
    if (!["completed", "stopped"].includes(this.phase)) {
      this.phase = "stopped";
      this.take.status = "stopped";
      this.take.endedAt = at;
      this.log("stopped", at, "Session ended before completion.");
    }
  }
}
