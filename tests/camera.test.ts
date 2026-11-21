import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cameraConstraints, cameraFailure, cameraSummary, measureCameraFps, safeCameraLabel, summarizeFps } from "../src/sdk/camera";
import { sdkFailure } from "../src/sdk/errors";
import { SmartSpectraErrorCode } from "@smartspectra/node-sdk/renderer";
import { allowCameraCheck, allowCameraRequest } from "../electron/camera-policy";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("camera policy and error classification", () => {
  const entry = "file:///C:/Cuelira/dist/index.html";
  const check = { mediaType: "video" as const, isMainFrame: true, requestingUrl: entry };
  it("allows only a consented video request/check from the bundled main document", () => {
    expect(allowCameraCheck(true, "media", true, entry, check)).toBe(true);
    for (const details of [{ ...check, mediaType: undefined }, { ...check, mediaType: "audio" as const },
      { ...check, isMainFrame: false }, { ...check, requestingUrl: "https://example.com" }])
      expect(allowCameraCheck(true, "media", true, entry, details)).toBe(false);
    expect(allowCameraCheck(false, "media", true, entry, check)).toBe(false);
    expect(allowCameraCheck(true, "media", false, entry, check)).toBe(false);
    expect(allowCameraCheck(true, "notifications", true, entry, check)).toBe(false);
    for (const mediaTypes of [[], ["audio"], ["audio", "video"]] as ("audio" | "video")[][])
      expect(allowCameraRequest(true, "media", true, entry, { ...check, mediaTypes })).toBe(false);
    expect(allowCameraRequest(true, "media", true, entry, { ...check, mediaTypes: ["video"] })).toBe(true);
    expect(allowCameraRequest(true, "media", false, entry, { ...check, mediaTypes: ["video"] })).toBe(false);
    expect(allowCameraRequest(true, "media", true, entry, { ...check, isMainFrame: false, mediaTypes: ["video"] })).toBe(false);
  });
  it("requests exact device selection but negotiable capture preferences, with no microphone", () => {
    expect(cameraConstraints("phone", "480p")).toEqual({ audio: false, video: {
      deviceId: { exact: "phone" }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 },
    } });
    expect(cameraConstraints("", "720p")).toEqual({ audio: false, video: {
      facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 },
    } });
  });
  it("uses safe labels and negotiated settings, and flags IR without guessing RGB identity", () => {
    expect(safeCameraLabel("\u202eOV01AS\u0000 (1234:abcd)")).toBe("OV01AS");
    expect(safeCameraLabel("", 1)).toBe("Camera 2");
    const report = cameraSummary({ label: "Infrared camera", getSettings: () => ({ width: 640, height: 360, frameRate: 15 }) } as MediaStreamTrack);
    expect(report).toMatchObject({ width: 640, height: 360, negotiatedFps: 15, ready: false, measuredFps: null });
    expect(report.warning).toContain("infrared/depth");
  });
  it("distinguishes permission, missing/busy device, authentication, timing, initialization and FPS", () => {
    expect(SmartSpectraErrorCode.kSustainedLowFrameRate).toBe(14);
    expect(sdkFailure(14, true)).toContain("sustained low frame rate");
    expect(sdkFailure(14)).not.toMatch(/credential|developer key|network/);
    expect(sdkFailure(2)).toContain("authentication failed");
    expect(sdkFailure(13)).toContain("not authorized");
    expect(sdkFailure(5)).toContain("connection failed");
    expect(sdkFailure(10)).toContain("timing error");
    expect(sdkFailure("SMARTSPECTRA_IPC_TIMEOUT")).toContain("IPC timeout");
    expect(sdkFailure(undefined)).toContain("initialization");
    expect(cameraFailure({ name: "NotAllowedError", message: "secret" }).message).toContain("permission denied");
    expect(cameraFailure({ name: "NotFoundError" }).message).toContain("unavailable");
    expect(cameraFailure({ name: "NotReadableError" }).message).toContain("Close Camera");
    expect(cameraFailure({ message: "secret" }).message).not.toContain("secret");
  });
});

describe("actual delivered preview frame counting (simulated callback metadata only)", () => {
  let tick: VideoFrameRequestCallback;
  let video: HTMLVideoElement;
  let visibility: EventTarget & { visibilityState: string };
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = Object.assign(new EventTarget(), { visibilityState: "visible" });
    vi.stubGlobal("document", visibility);
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
    video = { requestVideoFrameCallback: vi.fn(cb => { tick = cb; return 1; }), cancelVideoFrameCallback: vi.fn() } as unknown as HTMLVideoElement;
  });
  afterEach(() => vi.restoreAllMocks());
  async function runFrames(fps: number, stalled = false) {
    const progress = vi.fn();
    const pending = measureCameraFps(video, new AbortController().signal, progress);
    let counter = 0;
    tick(0, { presentedFrames: counter } as VideoFrameCallbackMetadata);
    await vi.advanceTimersByTimeAsync(1000);
    for (let i = 0; i < 4; i++) {
      // Missed callback intervals are covered by the browser's cumulative count.
      if (!(stalled && i === 3)) {
        counter += fps * 2;
        tick(0, { presentedFrames: counter } as VideoFrameCallbackMetadata);
      }
      await vi.advanceTimersByTimeAsync(2000);
    }
    return { result: await pending, progress };
  }
  it("counts delivered frames independently of a claimed 30-FPS setting", async () => {
    expect((await runFrames(10)).result).toMatchObject({ measuredFps: 10, ready: false });
    expect(video.cancelVideoFrameCallback).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("requires all four windows, including a freeze at the end, to reach 25 FPS", async () => {
    expect((await runFrames(30)).result).toMatchObject({ measuredFps: 30, lowestWindowFps: 30, ready: true });
    expect((await runFrames(30, true)).result).toMatchObject({ measuredFps: 22.5, lowestWindowFps: 0, ready: false });
    expect(summarizeFps([{ frames: 60, elapsedMs: 2000 }]).ready).toBe(false);
    expect(summarizeFps([]).ready).toBe(false);
    expect(summarizeFps([{ frames: NaN, elapsedMs: 2000 }]).ready).toBe(false);
  });
  it("reports zero when there are no callbacks, rather than trusting constraints", async () => {
    const pending = measureCameraFps(video, new AbortController().signal, vi.fn());
    await vi.advanceTimersByTimeAsync(9000);
    expect(await pending).toMatchObject({ measuredFps: 0, ready: false });
  });
  it("cancels measurement and callbacks on stop or when the app becomes hidden", async () => {
    const controller = new AbortController();
    const pending = measureCameraFps(video, controller.signal, vi.fn());
    const rejection = expect(pending).rejects.toThrow("canceled");
    controller.abort(); await rejection;
    expect(vi.getTimerCount()).toBe(0);
    const hidden = measureCameraFps(video, new AbortController().signal, vi.fn());
    const hiddenRejection = expect(hidden).rejects.toThrow("foreground");
    visibility.visibilityState = "hidden";
    visibility.dispatchEvent(new Event("visibilitychange"));
    await hiddenRejection;
    expect(video.cancelVideoFrameCallback).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
