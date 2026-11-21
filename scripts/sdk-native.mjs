import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { fork } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
if (require("@smartspectra/node-sdk/package.json").version !== "3.5.0")
  throw new Error("Native acceptance is pinned to the installed SDK 3.5.0.");
const output = path.resolve("artifacts/sdk-native");
await mkdir(output, { recursive: true });
await build({ entryPoints: ["tools/native-sdk/worker.ts"], outfile: path.join(output, "worker.cjs"),
  bundle: true, platform: "node", format: "cjs", target: "node22", external: ["@smartspectra/node-sdk", "@smartspectra/node-sdk/*"] });
if (process.argv.includes("--build-only")) process.exit(0);
const listOnly = process.argv.includes("--list-only");
if (!listOnly && (process.platform !== "win32" || process.arch !== "x64")) {
  console.error("This acceptance test requires native Windows x64 Node (not WSL). Samsung native capture is NOT TESTED here.");
  process.exit(2);
}
console.log("Direct native SmartSpectra 3.5.0 — no Electron/browser capture. No frames, landmarks, expression values or diagnostic files saved.");
const child = fork(path.join(output, "worker.cjs"), [], { silent: true, execArgv: [] });
// Native libraries can write sensitive free text. Only our narrow metadata IPC
// reaches the terminal; never echo raw worker stdout/stderr or exceptions.
child.stdout?.resume(); child.stderr?.resume();
let choices = [];
let summary = null;
let lastCounts = null;
let selected = null;
let started = false;
let discoverySucceeded = false;
let line;
let teardownTimer;
let deadline = setTimeout(() => abort("native-discovery-timeout"), 30000);
function abort(reason) {
  if (summary) return;
  summary = { verdict: "INCONCLUSIVE", reason, selected, sdkStartReturned: started,
    cleanup: "forced-worker-exit", counts: lastCounts };
  child.kill("SIGKILL"); // Last resort after timeout: OS releases this child's camera handles.
}
function requestStop(reason) {
  if (summary) return;
  if (child.connected) child.send({ type: "stop" });
  teardownTimer ??= setTimeout(() => abort(reason), 15000);
}
process.once("SIGINT", () => requestStop("canceled-teardown-timeout"));
async function onMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === "discovery") {
    discoverySucceeded = true;
    clearTimeout(deadline);
    choices = message.cameras;
    console.log(JSON.stringify({ sdk: message.sdkVersion, platform: `${process.platform}-${process.arch}`, nativeCameras: choices }, null, 2));
    if (listOnly || choices.length === 0) {
      summary = { verdict: listOnly ? "DISCOVERY_ONLY_NOT_CAPTURE" : "SAMSUNG_NOT_DISCOVERED",
        nativeCameras: choices, sdkStartReturned: false, cleanup: "no-session" };
      child.send({ type: "stop" });
      teardownTimer = setTimeout(() => child.kill("SIGKILL"), 15000);
      return;
    }
    line = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await line.question("Select your Samsung's native camera index, or type n if it is not listed: ");
    const index = /^\d+$/.test(answer.trim()) ? Number(answer.trim()) : -1;
    selected = choices.find(c => c.index === index) ?? null;
    if (!selected) {
      summary = { verdict: "SAMSUNG_NOT_SELECTED_OR_NOT_LISTED", nativeCameras: choices, sdkStartReturned: false, cleanup: "no-session" };
      child.send({ type: "stop" }); line.close();
      teardownTimer = setTimeout(() => child.kill("SIGKILL"), 15000); return;
    }
    const consent = await line.question(`Confirm "${selected.name}" is your Samsung. Type YES to consent to a 30-second face-metrics test under Cuelira's Presage processing disclosure (telemetry off; no recording): `);
    line.close();
    if (consent.trim().toUpperCase() !== "YES") { requestStop("consent-declined"); return; }
    deadline = setTimeout(() => requestStop("native-session-timeout"), 90000);
    child.send({ type: "start", index, consent: true });
  } else if (message.type === "started") {
    started = true;
    console.log("Native SDK start() returned. Running or landmarks alone are not an expression PASS.");
  } else if (message.type === "progress") {
    lastCounts = message.counts;
    console.log(JSON.stringify({ nativeProgress: lastCounts }));
  } else if (message.type === "summary") {
    summary ??= message;
    clearTimeout(deadline); clearTimeout(teardownTimer);
    teardownTimer = setTimeout(() => {
      summary = { ...summary, cleanup: "forced-worker-exit", verdict: "INCONCLUSIVE_CLEANUP" };
      child.kill("SIGKILL");
    }, 5000);
  }
}
child.on("message", message => { void onMessage(message).catch(() => requestStop("input-or-ipc-failure")); });
child.on("error", () => abort("worker-launch-failed"));
child.once("close", () => {
  clearTimeout(deadline); clearTimeout(teardownTimer); line?.close();
  console.log(JSON.stringify({ nativeDiscoverySucceeded: discoverySucceeded, nativeCameras: choices,
    nativeAcceptance: summary ?? { verdict: "INCONCLUSIVE_WORKER_EXIT", selected,
    sdkStartReturned: started, counts: lastCounts },
    note: "Only an actual Windows Samsung run with fresh validated stable expressions establishes native expression delivery. No accepted Cuelira cue is claimed." }, null, 2));
  process.exitCode = ["PASS_FRESH_VALIDATED_EXPRESSIONS", "DISCOVERY_ONLY_NOT_CAPTURE"].includes(summary?.verdict) ? 0 : 2;
});
