import { describe, it, expect, vi, beforeEach } from "vitest";
import { Metrics, decodeMetrics } from "@smartspectra/node-sdk/messages";
import { normalize } from "../src/core/normalize";
import { faceMetrics } from "@smartspectra/node-sdk/renderer";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
describe("actual published SDK contracts (no live hardware)", () => {
  it("decodes real protobuf bytes through the official messages interface", () => {
    const now = Date.now();
    const input = {
      face: {
        expression: [
          {
            stable: true,
            timestamp: now * 1000,
            scores: [{ type: 8, confidence: 89 }],
          },
        ],
      },
    };
    const bytes = (Metrics as any).encode(input).finish();
    const observation = normalize(decodeMetrics(bytes), now, {
      code: 0,
      label: "kOk",
      face: "available",
    });
    expect(observation.expression).toBe("surprise");
    expect(observation.probability).toBeCloseTo(0.89);
    expect(observation.stable).toBe(true);
  });
  it("pins main policy to the published face bundle and inspected port contract", () => {
    expect([...faceMetrics]).toEqual([11, 12, 13, 14]);
    const source = readFileSync(
      require.resolve("@smartspectra/node-sdk/main"),
      "utf8",
    );
    expect(source).toContain("const ATTACH_CHANNEL = 'smartspectra:attach'");
    expect(source).toContain("case 'configure':");
    expect(source).toContain("data.options");
    expect(require("@smartspectra/node-sdk/package.json").version).toBe(
      "3.5.0",
    );
  });
});
