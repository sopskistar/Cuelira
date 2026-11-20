import type { Observation, Expression } from "./model";

// Generated protobuf enums in SmartSpectra 3.5.0. Scores are percentages, not 0–1.
const categories: Record<number, Expression> = {
  1: "angry",
  2: "contempt",
  3: "disgust",
  4: "fear",
  5: "happy",
  6: "neutral",
  7: "sad",
  8: "surprise",
};
export type Validation = {
  code: number | null;
  label: string;
  face: Observation["face"];
};
function object(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null
    ? (v as Record<string, unknown>)
    : null;
}
function timestamp(value: unknown): number | null {
  const text =
    typeof value === "object" && value !== null ? String(value) : value;
  if (
    typeof text !== "number" &&
    typeof text !== "string" &&
    typeof text !== "bigint"
  )
    return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
export function normalize(
  payload: unknown,
  receivedAt: number,
  validation: Validation,
): Observation {
  const face = object(object(payload)?.face);
  const expressions = Array.isArray(face?.expression) ? face.expression : [];
  const samples = expressions
    .map(object)
    .filter((v): v is Record<string, unknown> => v !== null);
  // Sort by payload sample timestamp: callback timestamps are not expression timestamps.
  const sample = samples.sort(
    (a, b) => (timestamp(b.timestamp) ?? 0) - (timestamp(a.timestamp) ?? 0),
  )[0];
  const us = timestamp(sample?.timestamp);
  const scores: Partial<Record<Expression, number>> = {};
  let malformed = false;
  for (const entry of Array.isArray(sample?.scores) ? sample.scores : []) {
    const score = object(entry);
    const category = categories[Number(score?.type)];
    if (!category) continue;
    const confidence = score?.confidence;
    if (
      typeof confidence !== "number" ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 100 ||
      scores[category] !== undefined
    ) {
      malformed = true;
      continue;
    }
    scores[category] = confidence / 100;
  }
  const ranked = (Object.entries(scores) as [Expression, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  const missing = !sample || !us || !ranked.length || malformed;
  return {
    source: "presage-smartspectra",
    capturedAt: us ? us / 1000 : 0,
    sdkTimestampUs: us ? String(us) : "",
    receivedAt,
    expression: missing ? null : ranked[0][0],
    probability: missing ? null : ranked[0][1],
    scores,
    stable: sample?.stable === true && !missing,
    face: validation.face,
    validationCode: validation.code,
    validation: validation.label,
    reason: missing
      ? "Missing or invalid expression sample"
      : validation.code !== 0
        ? validation.label
        : null,
  };
}
