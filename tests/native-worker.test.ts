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
    {id:'fixture-samsung-id',name:'Samsung fixture'}]; }
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

function run(index: number) {
  return new Promise<any[]>((resolve, reject) => {
    const child = fork(path.join(directory, "worker.cjs"), [], { silent: true, execArgv: [],
      env: { ...process.env, PRESAGE_API_KEY: "native-test-placeholder", SMARTSPECTRA_API_KEY: "" } });
    child.stdout?.resume(); child.stderr?.resume();
    const messages: any[] = [];
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Fixture worker timed out")); }, 8000);
    child.on("message", (message: any) => {
      messages.push(message);
      if (message.type === "discovery") child.send({ type: "start", index, consent: true });
    });
    child.once("error", reject);
    child.once("close", () => { clearTimeout(timer); resolve(messages); });
  });
}
describe("native child lifecycle with explicit test-only SDK double (not hardware)", () => {
  it("selects the exact discovered ID, preserves privacy, stops outside callbacks and never retries error 14", async () => {
    const messages = await run(1);
    expect(messages.find(m => m.type === "fixture-selection").selection).toEqual({ kind: "byId", id: "fixture-samsung-id" });
    expect(messages.filter(m => m.type === "fixture-start")).toHaveLength(1);
    expect(messages.filter(m => m.type === "fixture-stop")).toHaveLength(1);
    expect(messages.filter(m => m.type === "fixture-destroy")).toHaveLength(1);
    expect(messages.find(m => m.type === "fixture-constructor")).toMatchObject({ telemetry: false, metrics: [11,12,13,14] });
    const report = messages.find(m => m.type === "summary");
    expect(report).toMatchObject({ verdict: "FAILED_SDK_ERROR", sdkStartReturned: true, cleanup: "complete",
      selected: { index: 1, name: "Samsung fixture" }, counts: { validationCodes: { 11: 1 }, errorCodes: { 14: 1 } } });
    expect(JSON.stringify(messages.filter(m => !m.type.startsWith("fixture-"))))
      .not.toMatch(/fixture-samsung-id|native-test-placeholder|sensitive fixture|timestamp|landmarks/);
  }, 15000);
  it("rejects a missing/disappeared index before SDK construction; never opens default camera", async () => {
    const messages = await run(99);
    expect(messages.some(m => m.type === "fixture-constructor" || m.type === "fixture-start")).toBe(false);
    expect(messages.find(m => m.type === "summary")).toMatchObject({ reason: "invalid-selection-or-consent", sdkStartReturned: false });
  }, 15000);
});
