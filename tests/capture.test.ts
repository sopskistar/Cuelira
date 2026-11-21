import { beforeEach, describe, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({
  instances: [] as any[],
  startupFailure: false,
  lowFps: false,
  stream: null as any,
}));
vi.mock("../src/sdk/camera", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/sdk/camera")>(),
  // Explicit FPS fixture; real counter/timer behavior is tested in camera.test.ts.
  measureCameraFps: vi.fn(async () => ({ measuredFps: fake.lowFps ? 10 : 30,
    lowestWindowFps: fake.lowFps ? 0 : 29, windows: 4, ready: !fake.lowFps })),
}));
vi.mock("@smartspectra/node-sdk/renderer", () => ({
  faceMetrics: [11, 12, 13, 14],
  ValidationCode: { kOk: 0, kNoFaceFound: 1 },
  ProcessingStatus: { kRunning: 3 },
  SmartSpectraErrorCode: { kAuthenticationFailed: 2, kCreditExhausted: 4, kSustainedLowFrameRate: 14,
    kNetworkError: 5, kServerError: 6, kInputUnavailable: 7, kNonMonotonicTimestamp: 10, kTimestampGap: 11, kMetricNotAuthorized: 13 },
  SmartSpectraSDK: class {
    handlers: Record<string, (...args: any[]) => void> = {};
    stop = vi.fn(async () => {});
    destroy = vi.fn();
    useMediaStream = vi.fn(() => this);
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
  fake.lowFps = false;
  const track = { label: "OV01AS", readyState: "live", stop: vi.fn(), addEventListener: vi.fn(),
    getSettings: () => ({ deviceId: "dell-fixture", width: 1280, height: 720, frameRate: 30 }) };
  fake.stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  vi.stubGlobal("navigator", { mediaDevices: {
    getUserMedia: vi.fn(async () => fake.stream),
    enumerateDevices: vi.fn(async () => [
      { kind: "videoinput", deviceId: "dell-fixture", label: "OV01AS" },
      { kind: "videoinput", deviceId: "phone-fixture", label: "Samsung connected camera" },
      { kind: "audioinput", deviceId: "microphone", label: "Microphone" },
    ]),
  } });
  vi.stubGlobal("window", {
    cuelira: {
      info: async () => ({ keyConfigured: true, sdkAvailable: true }),
    },
  });
});
const video = () => ({ srcObject: null, play: vi.fn(async () => {}) }) as unknown as HTMLVideoElement;
async function prepared(callbacks: ConstructorParameters<typeof LiveCapture>[0]) {
  const live = new LiveCapture(callbacks);
  await live.prepareCamera(video());
  return live;
}
describe("official adapter lifecycle with SDK fixture double", () => {
  it("never returns raw native startup diagnostics to the actor", async () => {
    fake.startupFailure = true;
    const live = await prepared({
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
    const live = await prepared(callbacks);
    await live.start();
    const sdk = fake.instances[0];
    expect(sdk.useMediaStream).toHaveBeenCalledWith(fake.stream);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
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
    const live = await prepared(callbacks);
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
    await live.prepareCamera(video());
    await live.start();
    expect(fake.instances).toHaveLength(2);
    await live.stop();
  });
  it("keeps the SDK off for low preview FPS and permits another camera only after stop", async () => {
    const callbacks = { observation: vi.fn(), stream: vi.fn(), status: vi.fn(), error: vi.fn(), cameras: vi.fn(), camera: vi.fn() };
    fake.lowFps = true;
    const live = await prepared(callbacks);
    expect(fake.instances).toHaveLength(0);
    expect(callbacks.cameras.mock.calls[0][0].map((d: any) => d.label)).toEqual(["OV01AS", "Samsung connected camera"]);
    await expect(live.prepareCamera(video(), "phone-fixture")).rejects.toThrow("Stop the current camera");
    await expect(live.start()).rejects.toThrow("Check the selected camera first");
    expect(fake.stream.getTracks()[0].stop).toHaveBeenCalled();
    const phoneTrack = { ...fake.stream.getTracks()[0], label: "Samsung connected camera",
      getSettings: () => ({ deviceId: "phone-fixture", width: 640, height: 480, frameRate: 30 }) };
    fake.stream = { getTracks: () => [phoneTrack], getVideoTracks: () => [phoneTrack] };
    fake.lowFps = false;
    await live.prepareCamera(video(), "phone-fixture", "480p");
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: {
      deviceId: { exact: "phone-fixture" }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 },
    } });
    await live.start();
    expect(fake.instances[0].useMediaStream).toHaveBeenCalledWith(fake.stream);
    fake.instances[0].handlers.error(14, "private native data", true);
    expect(callbacks.error.mock.calls.at(-1)?.[0]).toContain("sustained low frame rate");
    expect(callbacks.error.mock.calls.at(-1)?.[0]).not.toMatch(/credential|private native/);
    await live.stop();
  });
  it("releases a camera that opens after startup cancellation", async () => {
    let resolve!: (s: any) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const live = new LiveCapture({ observation: vi.fn(), stream: vi.fn(), status: vi.fn(), error: vi.fn() });
    const pending = live.prepareCamera(video());
    await live.stop();
    resolve(fake.stream);
    await expect(pending).rejects.toThrow("canceled");
    expect(fake.stream.getTracks()[0].stop).toHaveBeenCalledTimes(1);
    expect(fake.instances).toHaveLength(0);
  });
  it("separates camera denial from credentials and cleans up a failed preview", async () => {
    const callbacks = { observation: vi.fn(), stream: vi.fn(), status: vi.fn(), error: vi.fn() };
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce({ name: "NotAllowedError", message: "private details" });
    const live = new LiveCapture(callbacks);
    await expect(live.prepareCamera(video())).rejects.toThrow("Camera permission denied");
    expect(fake.instances).toHaveLength(0);
    const broken = video();
    broken.play = async () => { throw new Error("preview unavailable"); };
    await expect(live.prepareCamera(broken)).rejects.toThrow("Camera preview did not start");
    expect(fake.stream.getTracks()[0].stop).toHaveBeenCalledTimes(1);
  });
  it("releases host tracks on camera disconnect during SDK capture and ignores late callbacks", async () => {
    const callbacks = { observation: vi.fn(), stream: vi.fn(), status: vi.fn(), error: vi.fn() };
    const live = await prepared(callbacks);
    const track = fake.stream.getVideoTracks()[0];
    await live.start();
    const ended = track.addEventListener.mock.calls.find((call: any[]) => call[0] === "ended")[1];
    ended();
    await live.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(fake.instances[0].stop).toHaveBeenCalledTimes(1);
    expect(callbacks.error).toHaveBeenCalledWith(expect.stringContaining("Camera disconnected"));
    fake.instances[0].handlers.validationStatus(1, 0, "late warning");
    expect(callbacks.observation).not.toHaveBeenCalled();
  });
  it("blocks another native session after failed teardown while releasing the camera", async () => {
    const live = await prepared({ observation: vi.fn(), stream: vi.fn(), status: vi.fn(), error: vi.fn() });
    await live.start();
    fake.instances[0].stop.mockRejectedValueOnce(new Error("native failure"));
    await expect(live.stop()).rejects.toThrow("Restart Cuelira");
    expect(fake.stream.getTracks()[0].stop).toHaveBeenCalledTimes(1);
    expect(fake.instances[0].destroy).toHaveBeenCalledTimes(1);
    await expect(live.prepareCamera(video())).rejects.toThrow("Restart Cuelira");
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });
});
