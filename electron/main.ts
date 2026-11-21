import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  dialog,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { TakeStore } from "./store";
import { enforceSdkPolicy } from "./sdk-policy";
import { allowCameraCheck, allowCameraRequest } from "./camera-policy";

app.setName("Cuelira");
if (process.env.CUELIRA_TEST_USER_DATA)
  app.setPath("userData", process.env.CUELIRA_TEST_USER_DATA);
if (!app.isPackaged)
  config({ path: path.resolve(__dirname, "../.env"), quiet: true });
// Packaged users may place a private .env in the OS application data directory.
else config({ path: path.join(app.getPath("userData"), ".env"), quiet: true });
const apiKey =
  process.env.PRESAGE_API_KEY || process.env.SMARTSPECTRA_API_KEY || "";
// Prevent inherited SDK debug logging from printing native diagnostic payloads.
delete process.env.SMARTSPECTRA_DIAGNOSTICS;
if (app.isPackaged) {
  const lib =
    process.platform === "win32"
      ? "smartspectra_capi.dll"
      : "libsmartspectra_capi.so";
  process.env.SMARTSPECTRA_CAPI_PATH = path.join(
    process.resourcesPath,
    "smartspectra",
    lib,
  );
}
let win: BrowserWindow;
let cameraConsent = false;
let recordingConsent = false;
let sdkAvailable = false;
let sdkFailure = "";
let attachPort: Electron.MessagePortMain | undefined;
let store: TakeStore;
const entry = path.resolve(__dirname, "../dist/index.html");
const entryUrl = pathToFileURL(entry).href;
function trusted(event: IpcMainInvokeEvent) {
  if (
    event.sender !== win.webContents ||
    event.senderFrame !== win.webContents.mainFrame ||
    event.senderFrame?.url !== entryUrl
  )
    throw new Error("Untrusted IPC sender");
}
function handler(channel: string, action: (...args: any[]) => unknown) {
  ipcMain.handle(`cuelira:${channel}`, (event, ...args) => {
    trusted(event);
    return action(...args);
  });
}
function register() {
  handler("info", () => ({
    desktop: true,
    keyConfigured: !!apiKey && !apiKey.startsWith("replace_"),
    sdkAvailable,
    platform: `${process.platform}-${process.arch}`,
    storage: store.directory,
    error: sdkFailure,
  }));
  handler("consent", (camera, recording) => {
    if (typeof camera !== "boolean" || typeof recording !== "boolean")
      throw new Error("Invalid consent");
    cameraConsent = camera;
    recordingConsent = camera && recording;
  });
  handler("list", () => store.list());
  handler("presage-policy", () =>
    shell.openExternal("https://presagetech.com/legal/privacy-policy"),
  );
  handler("save", (take) => store.save(take));
  handler("delete", (id) => store.delete(id));
  handler("video-save", (id, bytes) => {
    if (!recordingConsent) throw new Error("Recording consent is required");
    return store.video(id, bytes);
  });
  handler("video-read", async (id) => {
    const take = await store.read(id);
    if (!take.recordingSaved) return null;
    const bytes = await readFile(store.file(id, "webm"));
    return new Uint8Array(bytes);
  });
  handler("export", async (id, format) => {
    if (!["json", "txt", "webm"].includes(format))
      throw new Error("Unsupported export format");
    await store.read(id);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Export Cuelira take",
      defaultPath: `Cuelira-${id}.${format}`,
      filters: [{ name: "Take report / recording", extensions: [format] }],
    });
    if (canceled || !filePath) return false;
    await store.export(id, format, filePath);
    return true;
  });
}
app.whenReady().then(async () => {
  store = new TakeStore(path.join(app.getPath("userData"), "takes"));
  await store.recoverInterrupted();
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "Cuelira",
    backgroundColor: "#151919",
    icon: path.resolve(__dirname, "../assets/brand/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  register();
  session.defaultSession.setPermissionRequestHandler(
    (wc, permission, callback, details) => {
      callback(allowCameraRequest(wc === win.webContents && wc.getURL() === entryUrl,
        permission, cameraConsent, entryUrl, details));
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (wc, permission, _origin, details) =>
      allowCameraCheck(wc === win.webContents && wc.getURL() === entryUrl,
        permission, cameraConsent, entryUrl, details),
  );
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.on("will-attach-webview", (e) => e.preventDefault());
  // The SDK's official bind() handles native teardown and MessagePort acknowledgements.
  // Enforce consent, face-only metrics, telemetry opt-out and main-only credentials
  // on that port before its own handler receives configuration or frames.
  ipcMain.prependListener(
    "smartspectra:attach",
    (event: Electron.IpcMainEvent) => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame ||
        event.senderFrame?.url !== entryUrl ||
        !cameraConsent ||
        attachPort
      ) {
        event.ports.forEach((p) => p.close());
        return;
      }
      const port = event.ports[0];
      if (!port) return;
      attachPort = port;
      port.prependListener(
        "message",
        (e: { data: Record<string, unknown> }) => {
          if (e.data && typeof e.data === "object")
            enforceSdkPolicy(e.data, cameraConsent, apiKey);
        },
      );
      port.once("close", () => {
        if (attachPort === port) attachPort = undefined;
      });
    },
  );
  try {
    const { bindSmartSpectraIpc } =
      require("@smartspectra/node-sdk/main") as typeof import("@smartspectra/node-sdk/main");
    bindSmartSpectraIpc(win, {
      logger: () => {
        /* Do not persist native diagnostic payloads. */
      },
    });
    sdkAvailable = true;
  } catch {
    sdkFailure =
      "Native SmartSpectra runtime could not load. Use native Windows x64 with a fresh npm ci; see the platform guide.";
  }
  win.webContents.on("render-process-gone", () => {
    cameraConsent = false;
    recordingConsent = false;
    attachPort?.close();
  });
  win.on("closed", () => {
    cameraConsent = false;
    recordingConsent = false;
    attachPort?.close();
  });
  void win.loadFile(entry);
});
app.on("window-all-closed", () => app.quit());
