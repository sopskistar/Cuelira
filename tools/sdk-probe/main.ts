// Reduced official Electron quickstart, not a new Cuelira capture architecture.
import { app, BrowserWindow, ipcMain, session } from "electron";
import { config } from "dotenv";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { FrameAudit } from "./audit";
import type { bindSmartSpectraIpc as Bind } from "@smartspectra/node-sdk/main";

app.setName("Cuelira SDK Probe");
if (process.env.CUELIRA_TEST_USER_DATA) app.setPath("userData", process.env.CUELIRA_TEST_USER_DATA);
config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
const key = process.env.PRESAGE_API_KEY || process.env.SMARTSPECTRA_API_KEY || "";
delete process.env.SMARTSPECTRA_DIAGNOSTICS;
const entry = pathToFileURL(path.join(__dirname, "index.html")).href;
let consent = false;
let win: BrowserWindow;
let activePort: Electron.MessagePortMain | null = null;
let audit = new FrameAudit();
let dropWarnings = 0;
let runtimeAvailable = false;
const mainAudit = !process.argv.includes("--baseline");
const loop = monitorEventLoopDelay({ resolution: 20 });

app.whenReady().then(() => {
  win = new BrowserWindow({ width: 950, height: 800, webPreferences: {
    preload: path.join(__dirname, "preload.cjs"), sandbox: true,
    contextIsolation: true, nodeIntegration: false, webSecurity: true,
  } });
  function trusted(event: Electron.IpcMainInvokeEvent) {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !== entry) throw new Error("Untrusted probe sender");
  }
  ipcMain.handle("probe:info", event => {
    trusted(event);
    return { sdk: "3.5.0", electron: process.versions.electron, chrome: process.versions.chrome,
      platform: `${process.platform}-${process.arch}`, keyConfigured: !!key && !key.startsWith("replace_"), runtimeAvailable, mainAudit };
  });
  ipcMain.handle("probe:consent", (event, value) => {
    trusted(event);
    if (typeof value !== "boolean") throw new Error("Invalid consent");
    consent = value;
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, _origin, details) =>
    wc === win.webContents && wc.getURL() === entry && permission === "media" && consent &&
    details.isMainFrame && details.requestingUrl === entry && details.mediaType === "video");
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const types = "mediaTypes" in details ? details.mediaTypes ?? [] : [];
    callback(wc === win.webContents && wc.getURL() === entry && consent && permission === "media" &&
      details.isMainFrame && details.requestingUrl === entry && types.length === 1 && types[0] === "video");
  });
  // Only the pinned credential/configuration boundary differs from the official
  // sample. SDK-owned capture, conversion, IPC and native sendFrame stay intact.
  ipcMain.prependListener("smartspectra:attach", (event: Electron.IpcMainEvent) => {
    const port = event.ports[0];
    if (!port) return;
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !== entry || !consent || activePort) {
      event.ports.forEach(p => p.close()); return;
    }
    activePort = port;
    audit = new FrameAudit();
    dropWarnings = 0;
    port.prependListener("message", (event: { data: Record<string, unknown> }) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (!consent && !["stop", "destroy", "reset"].includes(String(data.kind))) {
        data.kind = "probe-denied"; return;
      }
      if (data.kind === "configure") data.options = {
        apiKey: key, requestedMetrics: [11, 12, 13, 14], enableTelemetry: false, enableAccumulatedOutput: false,
      };
      if (data.kind === "requestInsight") data.kind = "probe-denied";
      if (mainAudit) audit.before(data);
    });
    port.once("close", () => { if (activePort === port) activePort = null; });
  });
  try {
    const { bindSmartSpectraIpc } = require("@smartspectra/node-sdk/main") as { bindSmartSpectraIpc: typeof Bind };
    bindSmartSpectraIpc(win, { logger: (_level, message) => {
      if (message.startsWith("dropped frame")) dropWarnings++;
      // Never print raw native logs, paths, metrics or credentials.
    } });
    runtimeAvailable = true;
    // Attach this listener AFTER bind's attach handler, so each frame's observer
    // brackets the SDK's synchronous main message handler without replacing it.
    ipcMain.on("smartspectra:attach", (event: Electron.IpcMainEvent) => {
      if (!mainAudit || event.ports[0] !== activePort) return;
      activePort?.on("message", (event: { data: Record<string, unknown> }) => {
        if (event.data && typeof event.data === "object") audit.after(event.data);
      });
    });
  } catch { runtimeAvailable = false; }
  if (mainAudit) loop.enable();
  const timer = setInterval(() => {
    if (!mainAudit || !consent || win.isDestroyed()) return;
    win.webContents.send("probe:sample", { ...audit.sample(), dropWarnings,
      mainEventLoopDelayMaxMs: Number.isFinite(loop.max) ? loop.max / 1000000 : null });
    loop.reset();
  }, 2000);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", e => e.preventDefault());
  win.webContents.on("will-attach-webview", e => e.preventDefault());
  win.webContents.on("render-process-gone", () => { consent = false; activePort?.close(); });
  win.once("closed", () => { consent = false; clearInterval(timer); loop.disable(); activePort?.close(); });
  void win.loadURL(entry);
});
app.on("window-all-closed", () => app.quit());
