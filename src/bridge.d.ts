import type { Take } from "./core/model";
export type RuntimeInfo = {
  desktop: boolean;
  keyConfigured: boolean;
  sdkAvailable: boolean;
  platform: string;
  storage: string;
  error?: string;
};
export type DesktopBridge = {
  info(): Promise<RuntimeInfo>;
  consent(camera: boolean, recording: boolean): Promise<void>;
  list(): Promise<Take[]>;
  save(take: Take): Promise<void>;
  delete(id: string): Promise<void>;
  export(id: string, format: "json" | "txt" | "webm"): Promise<boolean>;
  videoSave(id: string, bytes: ArrayBuffer): Promise<void>;
  videoRead(id: string): Promise<Uint8Array | null>;
  openPresagePolicy(): Promise<void>;
};
declare global {
  interface Window {
    cuelira?: DesktopBridge;
    __smartspectraBridge?: unknown;
  }
}
