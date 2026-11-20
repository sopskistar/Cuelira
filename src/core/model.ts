import { z } from "zod";

export const Expression = z.enum([
  "angry",
  "contempt",
  "disgust",
  "fear",
  "happy",
  "neutral",
  "sad",
  "surprise",
]);
export type Expression = z.infer<typeof Expression>;
export const ObservationSchema = z.object({
  source: z.literal("presage-smartspectra"),
  capturedAt: z.number().finite(),
  receivedAt: z.number().finite(),
  sdkTimestampUs: z.string(),
  expression: Expression.nullable(),
  probability: z.number().min(0).max(1).nullable(),
  scores: z.partialRecord(Expression, z.number().min(0).max(1)),
  stable: z.boolean(),
  face: z.enum(["available", "unavailable", "unknown"]),
  validationCode: z.number().nullable(),
  validation: z.string(),
  reason: z.string().nullable(),
});
export type Observation = z.infer<typeof ObservationSchema>;
export const EventSchema = z.object({
  at: z.number(),
  type: z.enum([
    "started",
    "armed",
    "observation",
    "unavailable",
    "accepted",
    "manual",
    "paused",
    "resumed",
    "timeout",
    "error",
    "completed",
    "stopped",
  ]),
  beat: z.number().int().min(0).max(3),
  detail: z.string().max(500),
  observation: ObservationSchema.optional(),
});
export type TakeEvent = z.infer<typeof EventSchema>;
export const TakeSchema = z.object({
  schema: z.literal(1),
  id: z.string().uuid(),
  scene: z.literal("The Last Message"),
  mode: z.enum(["live", "manual"]),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  status: z.enum(["rehearsing", "completed", "stopped"]),
  recordingConsent: z.boolean(),
  recordingSaved: z.boolean(),
  sdkVersion: z.literal("3.5.0"),
  thresholds: z.object({
    probability: z.number(),
    holdMs: z.number(),
    armDelayMs: z.number(),
    maxAgeMs: z.number(),
    maxGapMs: z.number(),
    cooldownMs: z.number(),
  }),
  events: z.array(EventSchema).max(10000),
});
export type Take = z.infer<typeof TakeSchema>;
export type Phase =
  | "ready"
  | "rehearsing"
  | "paused"
  | "completed"
  | "error"
  | "stopped";
export const thresholds = {
  probability: 0.65,
  holdMs: 700,
  armDelayMs: 8000,
  maxAgeMs: 1200,
  maxGapMs: 550,
  cooldownMs: 1500,
};
export const scene = [
  {
    title: "The discovery",
    cue: "surprise" as Expression,
    direction:
      "Let the realization register. Deliberately open your eyes and lift your brows; hold the expression briefly.",
    partner: "I was going to give it to you. Just… not tonight.",
    actor:
      "That message was sent on Monday. You watched me wait all week. You knew what it meant to me.",
    response:
      "I knew you would leave if you read it. I thought I could buy us one more day.",
  },
  {
    title: "The confrontation",
    cue: "angry" as Expression,
    direction:
      "Let your face become deliberately confrontational. Draw your brows together; keep your face in frame.",
    partner: "One more day. That is all I wanted.",
    actor:
      "You didn’t buy a day. You took my choice. Look at me and say it was yours to take.",
    response: "It wasn’t. I was afraid of being the person you left behind.",
  },
  {
    title: "The decision",
    cue: "neutral" as Expression,
    direction:
      "First hold a non-neutral expression after this beat begins, then deliberately release toward neutral. Hold the return.",
    partner: "Tell me what I can do now.",
    actor:
      "Give me the phone. No explanation. No promise. This time, I decide what happens next.",
    response: "Here. The message is still there. I haven’t touched it.",
  },
];
export const closing = "Then let me read it.";

export function report(take: Take): string {
  return [
    `# Cuelira — ${take.scene}`,
    "Your scene responds to you.",
    "",
    `Take: ${take.id}`,
    `Status: ${take.status}`,
    `Started: ${new Date(take.startedAt).toISOString()}`,
    `Mode: ${take.mode}; SDK version: ${take.sdkVersion}; event log is not independent hardware certification.`,
    `Video: ${take.recordingSaved ? "saved locally (silent)" : "not saved"}`,
    "",
    "These are observed performance cues, not acting scores or psychological conclusions.",
    "",
    ...take.events.map(
      (e) =>
        `${((e.at - take.startedAt) / 1000).toFixed(2)}s | Beat ${e.beat + 1} | ${e.type} | ${e.detail}${e.observation ? ` | ${e.observation.expression ?? "unavailable"} | confidence ${e.observation.probability === null ? "missing" : (e.observation.probability * 100).toFixed(1) + "%"} | stable ${e.observation.stable} | validation ${e.observation.validation}` : ""}`,
    ),
  ].join("\n");
}
