import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { build } from "esbuild";
import { fork } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
let directory: string;

beforeAll(async () => {
  await mkdir("artifacts", { recursive: true });
  directory = await mkdtemp(path.resolve("artifacts/native-worker-test-"));
  const fixture = path.join(directory, "sdk-fixture.cjs");
  // Explicit SDK lifecycle double, only substituted by this test build. The
  // shipping launcher has no fake provider, simulation flag or generated input.
  await writeFile(fixture, `
let callbackActive = false;
class SmartSpectraSDK {
  static version = '3.5.0';
  static availableCameras() { return [
    {id:'fixture-dell-id',name:'Dell fixture'},
    {id:'fixture-usb-id',name:'USB Webcam fixture'},
    {id:'fixture-virtual-id',name:'Windows Virtual Camera fixture'}]; }
  handlers = {};
  constructor(options) { process.send({type:'fixture-constructor',telemetry:options.enableTelemetry,metrics:options.requestedMetrics}); }
  on(name, callback) { this.handlers[name] = callback; return this; }
  useCamera(selection) { process.send({type:'fixture-selection',selection}); return this; }
  start() {
    process.send({type:'fixture-start'});
    this.handlers.processingStatus(3);
    this.handlers.validationStatus(11, 0, 'fixture only');
    callbackActive = true;
    this.handlers.error(14, 'sensitive fixture error: must never be relayed', true);
    callbackActive = false;
  }
  async stopAsync() { if(callbackActive) throw Error('native reentrant lifecycle'); process.send({type:'fixture-stop'}); }
  async destroy() { process.send({type:'fixture-destroy'}); }
}
module.exports = { SmartSpectraSDK, CameraSelection: {byId:id=>({kind:'byId',id})},
  faceMetrics:[11,12,13,14], SmartSpectraLogLevel:{kNone:4} };
`);
  await build({ entryPoints: ["tools/native-sdk/worker.ts"], outfile: path.join(directory, "worker.cjs"),
    bundle: true, platform: "node", format: "cjs", external: ["@smartspectra/node-sdk/messages"],
    plugins: [{ name: "test-only-native-sdk-double", setup(builder) {
      builder.onResolve({ filter: /^@smartspectra\/node-sdk$/ }, () => ({ path: fixture }));
    } }] });
});
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

function run(index: number, physicalCameraConfirmed: unknown = true, consent: unknown = true) {
  return new Promise<any[]>((resolve, reject) => {
    const child = fork(path.join(directory, "worker.cjs"), [], { silent: true, execArgv: [],
      env: { ...process.env, PRESAGE_API_KEY: "native-test-placeholder", SMARTSPECTRA_API_KEY: "" } });
    child.stdout?.resume(); child.stderr?.resume();
    const messages: any[] = [];
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Fixture worker timed out")); }, 8000);
    child.on("message", (message: any) => {
      messages.push(message);
      if (message.type === "discovery") child.send({ type: "start", index, consent, physicalCameraConfirmed });
    });
    child.once("error", reject);
    child.once("close", () => { clearTimeout(timer); resolve(messages); });
  });
}
describe("native child lifecycle with explicit test-only SDK double (not hardware)", () => {
  it.each([
    { index: 0, id: "fixture-dell-id", name: "Dell fixture" },
    { index: 1, id: "fixture-usb-id", name: "USB Webcam fixture" },
  ])("selects $name by exact discovered ID, preserves privacy, cleans up and never retries error 14", async ({ index, id, name }) => {
    const messages = await run(index);
    expect(messages.find(m => m.type === "fixture-selection").selection).toEqual({ kind: "byId", id });
    expect(messages.filter(m => m.type === "fixture-start")).toHaveLength(1);
    expect(messages.filter(m => m.type === "fixture-stop")).toHaveLength(1);
    expect(messages.filter(m => m.type === "fixture-destroy")).toHaveLength(1);
    expect(messages.find(m => m.type === "fixture-constructor")).toMatchObject({ telemetry: false, metrics: [11,12,13,14] });
    const report = messages.find(m => m.type === "summary");
    expect(report).toMatchObject({ verdict: "FAILED_SDK_ERROR", sdkStartReturned: true, cleanup: "complete",
      selected: { index, name }, counts: { validationCodes: { 11: 1 }, errorCodes: { 14: 1 } } });
    expect(JSON.stringify(messages.filter(m => !m.type.startsWith("fixture-"))))
      .not.toMatch(/fixture-(?:dell|usb|virtual)-id|native-test-placeholder|sensitive fixture|timestamp|landmarks/);
  }, 15000);
  it("rejects a missing/disappeared index before SDK construction; never opens default camera", async () => {
    const messages = await run(99);
    expect(messages.some(m => m.type === "fixture-constructor" || m.type === "fixture-start")).toBe(false);
    expect(messages.find(m => m.type === "summary")).toMatchObject({ reason: "invalid-selection-or-consent", sdkStartReturned: false });
  }, 15000);
  it("rejects a recognizable virtual camera even with consent and physical confirmation", async () => {
    const messages = await run(2);
    expect(messages.find(m => m.type === "discovery").cameras[2]).toMatchObject({ index: 2, blockedAsVirtual: true });
    expect(messages.some(m => m.type === "fixture-constructor" || m.type === "fixture-selection" || m.type === "fixture-start")).toBe(false);
    expect(messages.find(m => m.type === "summary")).toMatchObject({ verdict: "UNSUPPORTED_VIRTUAL_CAMERA", sdkStartReturned: false });
  }, 15000);
  it.each([
    { confirmation: false, consent: true },
    { confirmation: "true", consent: true },
    { confirmation: true, consent: false },
  ])("requires boolean physical confirmation and consent ($confirmation / $consent) before capture", async ({ confirmation, consent }) => {
    const messages = await run(0, confirmation, consent);
    expect(messages.some(m => m.type === "fixture-constructor" || m.type === "fixture-start")).toBe(false);
    expect(messages.find(m => m.type === "summary")).toMatchObject({ reason: "invalid-selection-or-consent", sdkStartReturned: false });
  }, 15000);
});
