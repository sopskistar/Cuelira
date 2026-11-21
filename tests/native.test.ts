import { describe, expect, it } from "vitest";
import { Metrics } from "@smartspectra/node-sdk/messages";
import { ProcessingStatus, ValidationCode } from "@smartspectra/node-sdk/renderer";
import { NativeCounts, nativeCameraName, nativeVerdict, unsupportedNativeCamera } from "../tools/native-sdk/counts";

// Explicit protobuf fixtures only; none establish a real camera or SDK session.
const now = 1800000000000;
const bytes = (timestamp = now * 1000, stable = true, confidence = 90) => Metrics.encode(Metrics.create({ face: {
  expression: [{ timestamp, stable, scores: [{ type: 8, confidence }] }],
} })).finish();
describe("native acceptance counters — synthetic protobuf fixtures, no hardware", () => {
  it("requires actual fresh stable expression fields, validation OK and Running; deduplicates", () => {
    expect(ProcessingStatus.kRunning).toBe(3);
    expect(ValidationCode.kOk).toBe(0);
    const counts = new NativeCounts();
    counts.state(ProcessingStatus.kRunning); counts.validate(ValidationCode.kOk);
    counts.metrics(bytes(), now); counts.metrics(bytes(), now);
    expect(counts.snapshot()).toMatchObject({ metricsEvents: 2, expressionSamples: 2,
      distinctScoredExpressions: 1, freshExpressions: 1, freshValidatedStableExpressions: 1, runningObserved: true });
    expect(nativeVerdict(counts.snapshot(), "complete")).toBe("PASS_FRESH_VALIDATED_EXPRESSIONS");
    expect(nativeVerdict(counts.snapshot(), "failed")).toBe("INCONCLUSIVE_CLEANUP");
  });
  it("does not pass for Running or landmark-only/empty packets", () => {
    const counts = new NativeCounts(); counts.state(3); counts.validate(0);
    counts.metrics(Metrics.encode(Metrics.create({ face: {} })).finish(), now);
    expect(counts.freshValidatedStableExpressions).toBe(0);
    expect(nativeVerdict(counts.snapshot(), "complete")).toBe("NO_FRESH_VALIDATED_EXPRESSIONS");
  });
  it("does not pass for an all-zero expression score vector", () => {
    const counts = new NativeCounts(); counts.state(3); counts.validate(0);
    counts.metrics(bytes(now * 1000, true, 0), now);
    expect(counts.expressionSamples).toBe(1);
    expect(counts.freshValidatedStableExpressions).toBe(0);
    expect(nativeVerdict(counts.snapshot(), "complete")).toBe("NO_FRESH_VALIDATED_EXPRESSIONS");
  });
  it("rejects stale, future, unstable and low-frame-rate validation samples without modifying timestamps", () => {
    const counts = new NativeCounts(); counts.state(3); counts.validate(0);
    counts.metrics(bytes((now - 5000) * 1000), now);
    counts.metrics(bytes(now * 1000, false), now);
    counts.validate(11); counts.metrics(bytes((now + 1) * 1000), now + 1);
    counts.validate(0); counts.metrics(bytes((now + 5000) * 1000), now);
    expect(counts.freshValidatedStableExpressions).toBe(0);
    expect(counts.freshExpressions).toBe(2);
    expect(counts.validationCodes[11]).toBe(1);
  });
  it("counts decode failures, invalid scores, processing changes and errors; cannot pass with SDK errors", () => {
    const counts = new NativeCounts(); counts.state(3); counts.validate(0);
    counts.metrics(new Uint8Array([255]), now);
    counts.metrics(bytes(now * 1000, true, 101), now);
    counts.state(5); counts.metrics(bytes((now + 1) * 1000), now + 1);
    expect(counts.snapshot()).toMatchObject({ metricsEvents: 3, decodeErrors: 1, freshValidatedStableExpressions: 0 });
    counts.state(3); counts.metrics(bytes((now + 2) * 1000), now + 2);
    counts.error(14);
    expect(counts.freshValidatedStableExpressions).toBe(1);
    expect(nativeVerdict(counts.snapshot(), "complete")).toBe("FAILED_SDK_ERROR");
  });
  it("exports only safe counts and names, not raw observations/IDs", () => {
    const counts = new NativeCounts(); counts.state(3); counts.validate(0); counts.metrics(bytes(), now);
    const report = JSON.stringify(counts.snapshot());
    expect(report).not.toMatch(/timestamp|landmarks|confidence|scores|surprise|deviceId|apiKey/);
    expect(nativeCameraName("USB Webcam\u202e\u001b\n (1234:abcd)", 1)).toBe("USB Webcam");
    expect(nativeCameraName(null, 2)).toBe("Unnamed native camera 2");
    expect(nativeCameraName("x".repeat(300), 0)).toHaveLength(100);
  });
  it("flags known virtual/phone labels without claiming unknown labels prove physical hardware", () => {
    for (const name of ["Windows Virtual Camera", "OBS Virtual Camera", "Samsung Camera", "Galaxy S24 Ultra", "iPhone Camera", "Android Camera", "DroidCam", "Phone Link", "Vir\u0000tual Camera"])
      expect(unsupportedNativeCamera(name)).toBe(true);
    for (const name of ["OV01AS", "Integrated Webcam", "Logitech USB Webcam", null])
      expect(unsupportedNativeCamera(name)).toBe(false);
  });
});
