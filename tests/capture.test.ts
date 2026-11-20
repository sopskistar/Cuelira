import { beforeEach, describe, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({
  instances: [] as any[],
  startupFailure: false,
}));
vi.mock("@smartspectra/node-sdk/renderer", () => ({
  faceMetrics: [11, 12, 13, 14],
  ValidationCode: { kOk: 0, kNoFaceFound: 1 },
  ProcessingStatus: { kRunning: 3 },
  SmartSpectraSDK: class {
    handlers: Record<string, (...args: any[]) => void> = {};
    stop = vi.fn(async () => {});
    destroy = vi.fn();
    start = vi.fn(async () => {
      if (fake.startupFailure)
        throw new Error("sensitive native diagnostic placeholder");
      this.handlers.processingStatus?.(3);
    });
    constructor(readonly options: unknown) {
      fake.instances.push(this);
    }
    on(event: string, callback: (...args: any[]) => void) {
      this.handlers[event] = callback;
      return this;
    }
  },
}));
import { LiveCapture } from "../src/sdk/live";
import { Metrics } from "@smartspectra/node-sdk/messages";
beforeEach(() => {
  fake.instances.length = 0;
  fake.startupFailure = false;
  vi.stubGlobal("window", {
    cuelira: {
      info: async () => ({ keyConfigured: true, sdkAvailable: true }),
    },
  });
});
describe("official adapter lifecycle with SDK fixture double", () => {
  it("never returns raw native startup diagnostics to the actor", async () => {
    fake.startupFailure = true;
    const live = new LiveCapture({
      observation: vi.fn(),
      stream: vi.fn(),
      status: vi.fn(),
      error: vi.fn(),
    });
    const result = live.start();
    await expect(result).rejects.toThrow(
      "Camera or SmartSpectra startup failed",
    );
    await expect(result).rejects.not.toThrow("sensitive native");
    expect(fake.instances[0].destroy).toHaveBeenCalledTimes(1);
  });
  it("prevents duplicate asynchronous startup and supports cancellation", async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal("window", {
      cuelira: {
        info: () =>
          new Promise((r) => {
            resolve = r;
          }),
      },
    });
    const live = new LiveCapture({
      observation: vi.fn(),
      stream: vi.fn(),
      status: vi.fn(),
      error: vi.fn(),
    });
    const pending = live.start();
    await expect(live.start()).rejects.toThrow("already exists");
    await live.stop();
    resolve({ keyConfigured: true, sdkAvailable: true });
    await expect(pending).rejects.toThrow("canceled");
    expect(fake.instances).toHaveLength(0);
  });
  it("requests face metrics, subscribes before start, decodes and stops exactly once", async () => {
    const callbacks = {
      observation: vi.fn(),
      stream: vi.fn(),
      status: vi.fn(),
      error: vi.fn(),
    };
    const live = new LiveCapture(callbacks);
    await live.start();
    const sdk = fake.instances[0];
    expect(sdk.options).toMatchObject({
      requestedMetrics: [11, 12, 13, 14],
      enableTelemetry: false,
    });
    expect(sdk.options).not.toHaveProperty("apiKey");
    expect(Object.keys(sdk.handlers)).toContain("metrics");
    sdk.handlers.validationStatus(0, Date.now() * 1000, "Face in frame");
    const bytes = (Metrics as any)
      .encode({
        face: {
          expression: [
            {
              timestamp: Date.now() * 1000,
              stable: true,
              scores: [{ type: 8, confidence: 90 }],
            },
          ],
        },
      })
      .finish();
    sdk.handlers.metrics(bytes);
    expect(callbacks.observation.mock.calls.at(-1)?.[0]).toMatchObject({
      expression: "surprise",
      probability: 0.9,
    });
    await expect(live.start()).rejects.toThrow("already exists");
    await live.stop();
    await live.stop();
    expect(sdk.stop).toHaveBeenCalledTimes(1);
    expect(sdk.destroy).toHaveBeenCalledTimes(1);
    sdk.handlers.metrics(bytes);
    expect(callbacks.observation).toHaveBeenCalledTimes(1);
  });
  it("does not initialize SDK with a missing key or browser-only context", async () => {
    const callbacks = {
      observation: vi.fn(),
      stream: vi.fn(),
      status: vi.fn(),
      error: vi.fn(),
    };
    vi.stubGlobal("window", {
      cuelira: { info: async () => ({ keyConfigured: false }) },
    });
    await expect(new LiveCapture(callbacks).start()).rejects.toThrow(
      "key missing",
    );
    expect(fake.instances).toHaveLength(0);
    vi.stubGlobal("window", {});
    await expect(new LiveCapture(callbacks).start()).rejects.toThrow(
      "native Electron",
    );
  });
  it("invalidates no-face, rejects malformed protobuf, sanitizes errors and recovers", async () => {
    const callbacks = {
      observation: vi.fn(),
      stream: vi.fn(),
      status: vi.fn(),
      error: vi.fn(),
    };
    const live = new LiveCapture(callbacks);
    await live.start();
    const sdk = fake.instances[0];
    sdk.handlers.validationStatus(1, 0, "No face");
    expect(callbacks.observation.mock.calls[0][0].face).toBe("unavailable");
    sdk.handlers.metrics(new Uint8Array([0xff]));
    expect(callbacks.error.mock.calls.at(-1)?.[0]).toContain(
      "could not be decoded",
    );
    sdk.handlers.error(4, "sensitive native detail", true);
    expect(callbacks.error.mock.calls.at(-1)?.[0]).not.toContain("sensitive");
    await live.stop();
    await live.start();
    expect(fake.instances).toHaveLength(2);
    await live.stop();
  });
});
