import {
  SmartSpectraSDK,
  faceMetrics,
  ValidationCode,
  ProcessingStatus,
} from "@smartspectra/node-sdk/renderer";
import { decodeMetrics } from "@smartspectra/node-sdk/messages";
import { normalize, type Validation } from "../core/normalize";
import type { Observation } from "../core/model";

export class LiveCapture {
  private sdk: SmartSpectraSDK | null = null;
  private stream: MediaStream | null = null;
  private opening = false;
  private generation = 0;
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
    },
  ) {}
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
      // API key is injected in main at the official port boundary, never returned
      // through the renderer/preload API. Capture is the official renderer lifecycle.
      const sdk = (this.sdk = new SmartSpectraSDK({
        requestedMetrics: [...faceMetrics],
        enableTelemetry: false,
        enableAccumulatedOutput: false,
        sendTimeoutMs: 15000,
      }));
      sdk.on("streamAvailable", (stream) => {
        if (generation !== this.generation) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.stream = stream;
        this.callbacks.stream(stream);
        stream.getVideoTracks().forEach((track) =>
          track.addEventListener(
            "ended",
            () => {
              if (generation === this.generation)
                this.callbacks.error(
                  "Camera disconnected. Stop and reconnect the camera, then retry.",
                );
            },
            { once: true },
          ),
        );
      });
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
      sdk.on("error", (code, _message, retryable) => {
        if (generation !== this.generation) return;
        this.callbacks.error(
          `SmartSpectra error ${code}. ${retryable ? "Stop and retry; check lighting, network and your credential." : "Stop capture and check the SDK configuration and credential."}`,
        );
      });
      this.callbacks.status("Starting");
      try {
        await sdk.start();
      } catch (nativeError) {
        const rawCode = (nativeError as { code?: unknown })?.code;
        const code =
          typeof rawCode === "number"
            ? String(rawCode)
            : rawCode === "SMARTSPECTRA_IPC_TIMEOUT"
              ? "IPC timeout"
              : "startup";
        throw new Error(
          `Camera or SmartSpectra startup failed (${code}). Check Windows camera permission, camera availability, network access and your private developer key, then retry.`,
        );
      }
      if (generation !== this.generation || this.sdk !== sdk)
        throw new Error(
          "Capture stopped during startup. Check the error and retry.",
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
    const sdk = this.sdk;
    this.sdk = null;
    // Stop owned tracks promptly even if native stop times out.
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.callbacks.stream(null);
    try {
      if (sdk) await sdk.stop();
    } catch {
      throw new Error(
        "SmartSpectra teardown did not settle. The camera tracks were stopped. Restart Cuelira before another live take.",
      );
    } finally {
      sdk?.destroy();
      this.callbacks.status("Camera off");
    }
  }
}
