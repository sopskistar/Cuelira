import { describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import { FrameAudit } from "../tools/sdk-probe/audit";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

describe("independent SDK probe metadata (explicit synthetic frame fixtures)", () => {
  it("counts main handlers separately from native callback counts and never mutates/retains a frame", () => {
    let clock = 0;
    const audit = new FrameAudit(() => clock);
    const buffer = new ArrayBuffer(1280 * 720 * 4);
    const frame = Object.freeze({ kind: "frame", buffer, width: 1280, height: 720, timestampUs: 1_000_000 });
    const port = new EventEmitter();
    port.prependListener("message", event => audit.before(event.data));
    // Models the inspected synchronous official main handler, not inference.
    port.on("message", () => { clock += 3; });
    port.on("message", event => audit.after(event.data));
    for (let i = 0; i < 60; i++) {
      clock = i * 2000 / 60;
      port.emit("message", { data: { ...frame, timestampUs: 1_000_000 + i * 1_000_000 / 30 } });
    }
    clock = 2000;
    const sample = audit.sample();
    expect(sample).toMatchObject({ mainFramesHandledPerSecond: 30, width: 1280, height: 720, nonIncreasingTimestamps: 0 });
    expect(sample.timestampCadenceFps).toBeCloseTo(30);
    expect(sample.synchronousHandlerMeanMs).toBeCloseTo(3);
    expect(sample.synchronousHandlerMaxMs).toBeCloseTo(3);
    expect(frame.buffer).toBe(buffer);
    expect(frame.timestampUs).toBe(1_000_000);
    expect(Object.values(audit)).not.toContain(buffer);
  });
  it("includes stalls in elapsed time, detects timestamp anomalies, resets and ignores control payloads", () => {
    let clock = 0;
    const audit = new FrameAudit(() => clock);
    audit.before({ kind: "configure", options: { apiKey: "test-placeholder" } });
    audit.after({ kind: "configure" });
    for (const ts of [1000000, 1000000, 2000000]) {
      audit.before({ kind: "frame", timestampUs: ts, width: 640, height: 480, buffer: new ArrayBuffer(4) });
      clock += 100; audit.after({ kind: "frame" });
    }
    clock = 2000;
    expect(audit.sample()).toMatchObject({ mainFramesHandledPerSecond: 1.5, nonIncreasingTimestamps: 1,
      maxTimestampGapMs: 1000, synchronousHandlerMeanMs: 100, synchronousHandlerMaxMs: 100 });
    clock = 4000;
    expect(audit.sample()).toMatchObject({ mainFramesHandledPerSecond: 0, timestampCadenceFps: null,
      nonIncreasingTimestamps: 0, synchronousHandlerMeanMs: null });
    expect(JSON.stringify(audit)).not.toContain("test-placeholder");
  });
  it("pins the callback provenance and extraction path to the actual installed 3.5.0 sources", () => {
    const main = readFileSync(require.resolve("@smartspectra/node-sdk/main"), "utf8");
    const renderer = readFileSync(require.resolve("@smartspectra/node-sdk/renderer"), "utf8");
    const ffi = readFileSync(new URL("../node_modules/@smartspectra/node-sdk/js/ffi.js", import.meta.url), "utf8");
    expect(main).toContain("sdk.on('frameSentThrough'");
    expect(main).toContain("sdk.sendFrame(");
    expect(renderer).toContain("ctx.getImageData(");
    expect(renderer).toContain("this._bridge.postMessage({");
    expect(ffi).toContain("function wrapFrame(jsFn)");
    expect(ffi).toContain("jsFn(sent !== 0, timestampUs)");
    // sendFrame's return is distinct from the later on_frame callback.
    expect(ffi).toContain("if (rc !== 0) throw makeFfiError(err)");
    expect(ffi).toContain("return true;");
  });
});
