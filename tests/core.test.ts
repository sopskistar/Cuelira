import { describe, it, expect } from "vitest";
import { normalize } from "../src/core/normalize";
import { Rehearsal } from "../src/core/engine";
import { thresholds, type Observation } from "../src/core/model";
const base = 1795130000000;
const config = { ...thresholds, armDelayMs: 1000 };
const valid = { code: 0, label: "kOk", face: "available" as const };
function obs(
  at: number,
  expression: Observation["expression"] = "surprise",
  overrides: Partial<Observation> = {},
): Observation {
  return {
    source: "presage-smartspectra",
    capturedAt: at,
    receivedAt: at,
    sdkTimestampUs: String(at * 1000),
    expression,
    probability: 0.8,
    scores: {},
    stable: true,
    face: "available",
    validationCode: 0,
    validation: "kOk",
    reason: null,
    ...overrides,
  };
}
function engine() {
  const e = new Rehearsal(false, config);
  e.start(base);
  return e;
}
function hold(e: Rehearsal, at: number, cue: Observation["expression"]) {
  for (let i = 0; i <= 1000; i += 200) e.observe(obs(at + i, cue), at + i);
}
describe("documented expression payload normalization", () => {
  it("converts percentage scores and epoch microseconds without guessing", () => {
    const o = normalize(
      {
        face: {
          expression: [
            {
              timestamp: String(base * 1000),
              stable: true,
              scores: [
                { type: 8, confidence: 82 },
                { type: 6, confidence: 18 },
              ],
            },
          ],
        },
      },
      base + 10,
      valid,
    );
    expect(o.expression).toBe("surprise");
    expect(o.probability).toBe(0.82);
    expect(o.capturedAt).toBe(base);
    expect(o.stable).toBe(true);
  });
  it("handles protobuf Long timestamps and picks the newest sample", () => {
    expect(
      normalize(
        {
          face: {
            expression: [
              {
                timestamp: { toString: () => String(base * 1000) },
                scores: [{ type: 1, confidence: 70 }],
              },
              {
                timestamp: (base - 1) * 1000,
                scores: [{ type: 6, confidence: 99 }],
              },
            ],
          },
        },
        base,
        valid,
      ).expression,
    ).toBe("angry");
  });
  it.each([
    undefined,
    {},
    { face: {} },
    {
      face: {
        expression: [
          { timestamp: base * 1000, scores: [{ type: 8, confidence: 110 }] },
        ],
      },
    },
  ])("does not invent missing fields: %j", (input) => {
    const o = normalize(input, base, valid);
    expect(o.probability).toBeNull();
    expect(o.stable).toBe(false);
    expect(o.reason).toBeTruthy();
  });
  it("does not equate unknown validation with face availability", () => {
    expect(
      normalize({}, base, { code: null, label: "Waiting", face: "unknown" })
        .face,
    ).toBe("unknown");
  });
});
describe("live deterministic scene", () => {
  it("manual practice cannot accept observations even if a late callback is delivered", () => {
    const e = engine();
    e.take.mode = "manual";
    hold(e, base + 1200, "surprise");
    expect(e.beat).toBe(0);
    expect(e.take.events.filter((v) => v.type === "accepted")).toHaveLength(0);
  });
  it("arms after dialogue lead-in and accepts a sustained correct cue only once", () => {
    const e = engine();
    hold(e, base + 100, "surprise");
    expect(e.beat).toBe(0);
    hold(e, base + 1300, "surprise");
    expect(e.beat).toBe(1);
    expect(e.take.events.filter((x) => x.type === "accepted")).toHaveLength(1);
    hold(e, base + 2500, "surprise");
    expect(e.beat).toBe(1);
  });
  it.each([
    { stable: false },
    { probability: 0.64 },
    { validationCode: 2 },
    { face: "unavailable" as const },
    { expression: "happy" as const },
    { reason: "Missing metrics" },
  ])("rejects invalid cue %j", (overrides) => {
    const e = engine();
    for (let i = 1000; i <= 4000; i += 200)
      e.observe(obs(base + i, "surprise", overrides), base + i);
    expect(e.beat).toBe(0);
  });
  it("rejects stale and future observations", () => {
    const e = engine();
    e.observe(obs(base + 1000), base + 4000);
    e.observe(obs(base + 6000), base + 4000);
    expect(e.beat).toBe(0);
  });
  it("duplicate events and interrupted holds cannot complete a cue", () => {
    const e = engine();
    for (let i = 0; i < 20; i++) e.observe(obs(base + 1200), base + 1300);
    expect(e.beat).toBe(0);
    e.observe(obs(base + 1500), base + 1500);
    e.observe(obs(base + 1700, "happy"), base + 1700);
    e.observe(obs(base + 1900), base + 1900);
    expect(e.beat).toBe(0);
  });
  it("long sampling gaps reset stabilization", () => {
    const e = engine();
    e.observe(obs(base + 1100), base + 1100);
    e.observe(obs(base + 3000), base + 3000);
    expect(e.beat).toBe(0);
  });
  it("neutral requires a stable departure after final entry, including manual entry", () => {
    const e = engine();
    e.manual(base + 1500);
    e.manual(base + 3500);
    hold(e, base + 5000, "neutral");
    expect(e.phase).toBe("rehearsing");
    hold(e, base + 6200, "angry");
    hold(e, base + 7400, "neutral");
    expect(e.phase).toBe("completed");
    expect(e.take.events.filter((x) => x.type === "manual")).toHaveLength(2);
  });
  it("completes three accepted cues with causal observation evidence", () => {
    const e = engine();
    hold(e, base + 1200, "surprise");
    hold(e, base + 4000, "angry");
    hold(e, base + 6800, "angry");
    hold(e, base + 8000, "neutral");
    expect(e.phase).toBe("completed");
    expect(
      e.take.events
        .filter((x) => x.type === "accepted")
        .map((x) => x.observation?.expression),
    ).toEqual(["surprise", "angry", "neutral"]);
  });
  it("pause, error, recovery and restart never accept buffered cues", () => {
    const e = engine();
    e.pause(base + 2000);
    hold(e, base + 2200, "surprise");
    expect(e.beat).toBe(0);
    e.resume(base + 4000);
    e.observe(obs(base + 3000), base + 4000);
    expect(e.beat).toBe(0);
    e.fail(base + 5000, "Camera lost");
    hold(e, base + 5200, "surprise");
    expect(e.beat).toBe(0);
    e.recover(base + 7000);
    expect(e.phase).toBe("paused");
    e.stop(base + 8000);
    expect(e.take.status).toBe("stopped");
    expect(engine().beat).toBe(0);
  });
  it("records timeout without silently advancing", () => {
    const e = engine();
    e.tick(base + 36000);
    e.tick(base + 37000);
    expect(e.take.events.filter((x) => x.type === "timeout")).toHaveLength(1);
    expect(e.beat).toBe(0);
  });
});
