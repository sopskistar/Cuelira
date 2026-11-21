import {
  SmartSpectraSDK,
  faceMetrics,
  ValidationCode,
  ProcessingStatus,
} from "@smartspectra/node-sdk/renderer";
import { decodeMetrics } from "@smartspectra/node-sdk/messages";
import { normalize, type Validation } from "../core/normalize";
import type { Observation } from "../core/model";
import { cameraConstraints, cameraFailure, cameraSummary, measureCameraFps,
  safeCameraLabel, type CameraChoice, type CameraProfile, type CameraReport } from "./camera";
import { sdkFailure } from "./errors";

export class LiveCapture {
  private sdk: SmartSpectraSDK | null = null;
  private stream: MediaStream | null = null;
  private opening = false;
  private generation = 0;
  private check: AbortController | null = null;
  private report: CameraReport | null = null;
  private teardown: Promise<void> | null = null;
  private deliveryTimer: ReturnType<typeof setInterval> | null = null;
  private teardownFailed = false;
  private cameraInterruption = "";
  private validation: Validation = {
    code: null,
    label: "Waiting for SDK validation",
    face: "unknown",
  };
  constructor(
    private callbacks: {
      observation(o: Observation): void;
      stream(s: MediaStream | null): void;
      status(s: string): void;
      error(s: string): void;
      camera?(report: CameraReport): void;
      cameras?(devices: CameraChoice[]): void;
    },
  ) {}
  async refreshCameras() {
    let devices: MediaDeviceInfo[];
    try { devices = await navigator.mediaDevices.enumerateDevices(); }
    catch { throw new Error("Camera list unavailable. Check camera consent, reconnect the phone/webcam and refresh again."); }
    const choices = devices.filter(d => d.kind === "videoinput")
      .map((d, i) => ({ id: d.deviceId, label: safeCameraLabel(d.label, i) }));
    this.callbacks.cameras?.(choices);
    return choices;
  }
  async prepareCamera(video: HTMLVideoElement, deviceId = "", profile: CameraProfile = "720p") {
    if (this.opening || this.sdk || this.stream)
      throw new Error("Stop the current camera before checking another device or capture mode.");
    if (!window.cuelira)
      throw new Error("Open the native Electron app to check cameras. Browser preview cannot run the live SDK.");
    this.opening = true;
    this.cameraInterruption = "";
    const generation = ++this.generation;
    const check = (this.check = new AbortController());
    try {
      if (this.teardown) await this.teardown;
      if (this.teardownFailed) throw new Error("Restart Cuelira after the native teardown failure before opening another camera.");
      check.signal.throwIfAborted();
      this.callbacks.status("Opening selected camera");
      let stream: MediaStream;
      let cancelAcquisition: () => void = () => {};
      try {
        const acquisition = navigator.mediaDevices.getUserMedia(cameraConstraints(deviceId, profile))
          .then(stream => {
            if (check.signal.aborted) {
              stream.getTracks().forEach(t => t.stop());
              throw new Error("Camera startup canceled.");
            }
            return stream;
          });
        stream = await Promise.race([
          acquisition,
          new Promise<never>((_, reject) => {
            cancelAcquisition = () => reject(new Error("Camera startup canceled."));
            check.signal.addEventListener("abort", cancelAcquisition, { once: true });
          }),
        ]);
      } catch (error) {
        if (check.signal.aborted) throw new Error("Camera startup canceled.");
        throw cameraFailure(error);
      } finally {
        check.signal.removeEventListener("abort", cancelAcquisition);
      }
      if (generation !== this.generation) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error("Camera startup canceled.");
      }
      this.stream = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("Selected device supplied no video track.");
      track.addEventListener("ended", () => {
        if (this.stream === stream) {
          this.cameraInterruption = "Camera disconnected. Reconnect the phone/webcam, refresh cameras and retry.";
          void this.stop().catch(() => {});
          this.callbacks.error(this.cameraInterruption);
        }
      }, { once: true });
      this.callbacks.stream(stream);
      video.srcObject = stream;
      // A compositor counter can stall when the video is scrolled off screen.
      // Bring the actual preview into view after clicking the controls below it.
      video.scrollIntoView?.({ block: "center", behavior: "instant" });
      // Bound startup even if playback never settles; cancellation releases tracks immediately.
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let cancelPlay: () => void = () => {};
      try {
        await Promise.race([
          video.play().catch(() => { throw new Error("Camera preview did not start. Stop and reconnect the selected camera."); }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Camera preview did not start. Stop and reconnect the selected camera.")), 10000);
            cancelPlay = () => reject(new Error("Camera check canceled."));
            check.signal.addEventListener("abort", cancelPlay, { once: true });
          }),
        ]);
      } finally {
        clearTimeout(timeout);
        check.signal.removeEventListener("abort", cancelPlay);
      }
      check.signal.throwIfAborted();
      const choices = await this.refreshCameras();
      if (generation !== this.generation) throw new Error("Camera startup canceled.");
      const actual = track.getSettings().deviceId;
      if (deviceId && actual && actual !== deviceId)
        throw new Error("Camera selection did not match the requested device. Stop and select it again.");
      this.report = cameraSummary(track);
      // Prefer the granted track label, never IDs/group IDs in diagnostic output.
      if (!track.label && actual)
        this.report.label = choices.find(d => d.id === actual)?.label ?? this.report.label;
      this.callbacks.camera?.(this.report);
      this.callbacks.status("Checking delivered camera FPS (9 seconds)");
      const result = await measureCameraFps(video, check.signal, result => {
        if (generation !== this.generation || !this.report) return;
        this.report = { ...this.report, ...result };
        this.callbacks.camera?.(this.report);
      });
      if (generation !== this.generation) throw new Error("Camera check canceled.");
      this.report = { ...this.report, ...cameraSummary(track), ...result, phase: "checked" };
      this.callbacks.camera?.(this.report);
      this.callbacks.status(result.ready ? "Camera FPS check passed; SDK not started" : "Camera FPS too low; SDK not started");
    } catch (error) {
      await this.stop();
      if (this.cameraInterruption) throw new Error(this.cameraInterruption);
      throw error;
    } finally {
      check.abort();
      this.check = null;
      this.opening = false;
    }
  }
  async start() {
    if (this.opening || this.sdk)
      throw new Error("A capture session already exists");
    this.opening = true;
    const generation = ++this.generation;
    this.validation = {
      code: null,
      label: "Waiting for SDK validation",
      face: "unknown",
    };
    try {
      if (this.teardown) await this.teardown;
      if (this.teardownFailed) throw new Error("Restart Cuelira after the native teardown failure before another live take.");
      if (!window.cuelira)
        throw new Error(
          "Open the native Electron app to use SmartSpectra. Browser preview cannot run the live SDK.",
        );
      const info = await window.cuelira.info();
      if (generation !== this.generation)
        throw new Error("Camera startup canceled.");
      if (!info.keyConfigured)
        throw new Error(
          "Developer key missing. Add PRESAGE_API_KEY to your private .env and restart Cuelira.",
        );
      if (!info.sdkAvailable)
        throw new Error(info.error || "Native SDK unavailable");
      if (!this.stream || !this.report?.ready || this.stream.getVideoTracks()[0]?.readyState !== "live")
        throw new Error("Check the selected camera first. All four FPS windows must reach about 25 FPS before starting SmartSpectra.");
      // API key is injected in main at the official port boundary, never returned
      // through the renderer/preload API. Capture is the official renderer lifecycle.
      const sdk = (this.sdk = new SmartSpectraSDK({
        requestedMetrics: [...faceMetrics],
        enableTelemetry: false,
        enableAccumulatedOutput: false,
        sendTimeoutMs: 15000,
      }));
      sdk.useMediaStream(this.stream);
      this.report = { ...this.report, phase: "capturing" };
      this.callbacks.camera?.(this.report);
      // The official renderer emits no streamAvailable for host-owned streams.
      // Count successful native input callbacks separately to expose processing /
      // IPC contention after the local preview check. Do not touch timestamps.
      let delivered = 0;
      let deliveryTime = performance.now();
      sdk.on("frameSentThrough", (sent) => {
        if (generation === this.generation && sent) delivered++;
      });
      this.deliveryTimer = setInterval(() => {
        if (generation !== this.generation || !this.report) return;
        const now = performance.now();
        const settings = this.stream?.getVideoTracks()[0]?.getSettings();
        this.report = { ...this.report, width: settings?.width, height: settings?.height,
          negotiatedFps: settings?.frameRate, sdkFps: delivered * 1000 / (now - deliveryTime) };
        delivered = 0; deliveryTime = now;
        this.callbacks.camera?.(this.report);
      }, 2000);
      sdk.on("processingStatus", (status) => {
        if (generation !== this.generation) return;
        const name =
          Object.entries(ProcessingStatus).find(([, v]) => v === status)?.[0] ??
          String(status);
        this.callbacks.status(name.replace(/^k/, ""));
      });
      sdk.on("validationStatus", (code, _timestamp, hint) => {
        if (generation !== this.generation) return;
        const name =
          Object.entries(ValidationCode).find(([, v]) => v === code)?.[0] ??
          `Validation ${code}`;
        this.validation = {
          code,
          label: hint || name,
          face:
            code === ValidationCode.kOk
              ? "available"
              : code === ValidationCode.kNoFaceFound
                ? "unavailable"
                : "unknown",
        };
        // Invalidate previous good observations immediately on no-face/warnings.
        if (code !== ValidationCode.kOk)
          this.callbacks.observation(
            normalize({}, Date.now(), this.validation),
          );
      });
      sdk.on("metrics", (buffer) => {
        if (generation !== this.generation) return;
        try {
          // Validation is a state, not a documented heartbeat. Metric sample
          // timestamps enforce freshness; a new warning invalidates it immediately.
          this.callbacks.observation(
            normalize(decodeMetrics(buffer), Date.now(), this.validation),
          );
        } catch {
          this.callbacks.error(
            "SmartSpectra metrics could not be decoded. Stop and retry.",
          );
        }
      });
      let sessionFailure = "";
      sdk.on("error", (code, _message, retryable) => {
        if (generation !== this.generation) return;
        sessionFailure = sdkFailure(code, retryable);
        void this.stop().catch(() => {});
        this.callbacks.error(sessionFailure);
      });
      this.callbacks.status("Starting");
      try {
        await sdk.start();
      } catch (nativeError) {
        const rawCode = (nativeError as { code?: unknown })?.code;
        throw new Error(sessionFailure || sdkFailure(rawCode));
      }
      if (generation !== this.generation || this.sdk !== sdk)
        throw new Error(
          sessionFailure || "Capture stopped during startup. Check the error and retry.",
        );
    } catch (e) {
      await this.stop();
      throw e;
    } finally {
      this.opening = false;
    }
  }
  async stop() {
    this.generation++;
    this.check?.abort();
    if (this.deliveryTimer) clearInterval(this.deliveryTimer);
    this.deliveryTimer = null;
    const sdk = this.sdk;
    this.sdk = null;
    // Stop owned tracks promptly even if native stop times out.
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.callbacks.stream(null);
    if (this.report) {
      this.report = { ...this.report, ready: false, phase: "stopped" };
      this.callbacks.camera?.(this.report);
    }
    if (this.teardown) return this.teardown;
    this.teardown = (async () => {
      try { if (sdk) await sdk.stop(); }
      catch { this.teardownFailed = true; throw new Error("SmartSpectra teardown did not settle. The camera tracks were stopped. Restart Cuelira before another live take."); }
      finally { sdk?.destroy(); this.callbacks.status("Camera off"); }
    })();
    try { await this.teardown; } finally { this.teardown = null; }
  }
}
