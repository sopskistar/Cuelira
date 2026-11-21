import { decodeMetrics } from "@smartspectra/node-sdk/messages";

// Session counters only. No frames, landmarks, scores, categories or absolute
// timestamps are retained in reports or sent over the worker IPC channel.
export class NativeCounts {
  processingStates: Record<number, number> = {};
  validationCodes: Record<number, number> = {};
  errorCodes: Record<number, number> = {};
  metricsEvents = 0;
  expressionSamples = 0;
  distinctScoredExpressions = 0;
  freshExpressions = 0;
  freshValidatedStableExpressions = 0;
  decodeErrors = 0;
  runningObserved = false;
  private processing: number | null = null;
  private validation: number | null = null;
  private latestTimestamp = 0;
  state(code: number) {
    this.processingStates[code] = (this.processingStates[code] ?? 0) + 1;
    this.processing = code;
    if (code === 3) this.runningObserved = true; // ProcessingStatus.kRunning, pinned below by tests.
  }
  validate(code: number) {
    this.validationCodes[code] = (this.validationCodes[code] ?? 0) + 1;
    this.validation = code;
  }
  error(code: number) { this.errorCodes[code] = (this.errorCodes[code] ?? 0) + 1; }
  metrics(buffer: Uint8Array, receivedAtMs: number) {
    this.metricsEvents++;
    let decoded: ReturnType<typeof decodeMetrics>;
    try { decoded = decodeMetrics(buffer); } catch { this.decodeErrors++; return; }
    for (const sample of decoded.face?.expression ?? []) {
      this.expressionSamples++;
      const us = Number(sample.timestamp);
      if (!Number.isSafeInteger(us) || us <= this.latestTimestamp) continue;
      this.latestTimestamp = us;
      const scores = sample.scores ?? [];
      const types = new Set<number>();
      let scored = false, malformed = false, positive = false;
      for (const s of scores) {
        if (typeof s.type !== "number" || s.type < 1 || s.type > 8) continue;
        if (types.has(s.type) || typeof s.confidence !== "number" || !Number.isFinite(s.confidence) ||
          s.confidence < 0 || s.confidence > 100) malformed = true;
        else if (s.confidence > 0) positive = true;
        types.add(s.type); scored = true;
      }
      if (!scored || malformed || !positive) continue;
      this.distinctScoredExpressions++;
      const ageMs = receivedAtMs - us / 1000;
      if (ageMs < -250 || ageMs > 1200) continue;
      this.freshExpressions++;
      if (sample.stable === true && this.validation === 0 && this.processing === 3)
        this.freshValidatedStableExpressions++;
    }
  }
  snapshot() {
    return {
      processingStates: { ...this.processingStates }, validationCodes: { ...this.validationCodes },
      errorCodes: { ...this.errorCodes }, runningObserved: this.runningObserved,
      metricsEvents: this.metricsEvents, expressionSamples: this.expressionSamples,
      distinctScoredExpressions: this.distinctScoredExpressions, freshExpressions: this.freshExpressions,
      freshValidatedStableExpressions: this.freshValidatedStableExpressions, decodeErrors: this.decodeErrors,
    };
  }
}

export function nativeCameraName(name: string | null, index: number) {
  return (name ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s*\([^)]*[0-9a-f]{4}:[0-9a-f]{4}[^)]*\)/gi, "").trim().slice(0, 100) || `Unnamed native camera ${index}`;
}

// The SDK has no physical/virtual type flag. Block recognizable virtual/phone
// labels; other labels still require the user's explicit physical-device confirmation.
export function unsupportedNativeCamera(name: string | null) {
  const label = (name ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "");
  return /\b(?:virtual|obs|droidcam|iriun|epoccam|manycam|camo|continuity|phone|iphone|android|samsung|galaxy|s24|link to windows)\b/i.test(label);
}

export function nativeVerdict(counts: ReturnType<NativeCounts["snapshot"]>, cleanup: string) {
  if (cleanup !== "complete") return "INCONCLUSIVE_CLEANUP";
  if (Object.keys(counts.errorCodes).length) return "FAILED_SDK_ERROR";
  return counts.freshValidatedStableExpressions > 0 ? "PASS_FRESH_VALIDATED_EXPRESSIONS" : "NO_FRESH_VALIDATED_EXPRESSIONS";
}
