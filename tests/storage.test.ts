import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TakeStore } from "../electron/store";
import { Rehearsal } from "../src/core/engine";
import { enforceSdkPolicy } from "../electron/sdk-policy";
let directory: string;
let store: TakeStore;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "cuelira-test-"));
  store = new TakeStore(directory);
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
describe("take persistence, export and deletion", () => {
  it("persists actual events across instances, exports both reports and deletes", async () => {
    const e = new Rehearsal();
    e.start(Date.now());
    e.manual(Date.now());
    e.stop(Date.now());
    await store.save(e.take);
    expect((await new TakeStore(directory).list())[0].events).toEqual(
      e.take.events,
    );
    await store.export(e.take.id, "json", path.join(directory, "export.json"));
    await store.export(e.take.id, "txt", path.join(directory, "export.txt"));
    expect(
      JSON.parse(await readFile(path.join(directory, "export.json"), "utf8"))
        .id,
    ).toBe(e.take.id);
    expect(
      await readFile(path.join(directory, "export.txt"), "utf8"),
    ).toContain("Actor continued manually");
    await store.delete(e.take.id);
    await expect(store.read(e.take.id)).rejects.toThrow();
  });
  it("refuses traversal, malformed data and unconsented video", async () => {
    expect(() => store.file("../secret")).toThrow();
    await expect(store.save({})).rejects.toThrow();
    const e = new Rehearsal();
    await store.save(e.take);
    await expect(store.video(e.take.id, new ArrayBuffer(10))).rejects.toThrow(
      "not consented",
    );
  });
  it("records consented WebM container fixtures and deletes both files", async () => {
    const e = new Rehearsal(true);
    await store.save(e.take);
    // Container signature fixture only. This does not establish playable recording.
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0]).buffer;
    await store.video(e.take.id, bytes);
    expect((await store.read(e.take.id)).recordingSaved).toBe(true);
    await store.export(e.take.id, "webm", path.join(directory, "fixture.webm"));
    expect(
      (await readFile(path.join(directory, "fixture.webm"))).byteLength,
    ).toBe(6);
    await store.delete(e.take.id);
    await expect(readFile(store.file(e.take.id, "webm"))).rejects.toThrow();
  });
  it("skips corrupt records while retaining good takes", async () => {
    const e = new Rehearsal();
    await store.save(e.take);
    await writeFile(path.join(directory, "bad.json"), "{broken");
    expect(await store.list()).toHaveLength(1);
  });
  it("serializes checkpoints and recovers interrupted takes honestly", async () => {
    const e = new Rehearsal();
    e.start(1000);
    const first = store.save(e.take);
    e.manual(2000);
    const second = store.save(e.take);
    await Promise.all([first, second]);
    await new TakeStore(directory).recoverInterrupted();
    const take = await store.read(e.take.id);
    expect(take.status).toBe("stopped");
    expect(take.endedAt).toBe(2000);
    expect(take.events.at(-1)?.detail).toContain(
      "exact interruption time is unknown",
    );
  });
});
describe("main-side SDK consent and credential policy", () => {
  it("enforces face bundle, disabled telemetry and main-only credential", () => {
    const message = {
      kind: "configure",
      options: {
        enableTelemetry: true,
        requestedMetrics: [0],
        apiKey: "renderer-input",
      },
    };
    enforceSdkPolicy(message, true, "local-test-placeholder");
    expect(message.options).toEqual({
      apiKey: "local-test-placeholder",
      requestedMetrics: [11, 12, 13, 14],
      enableAccumulatedOutput: false,
      enableTelemetry: false,
    });
  });
  it("blocks capture without consent and never enables insights", () => {
    for (const kind of ["configure", "start", "frame"]) {
      const m = { kind };
      enforceSdkPolicy(m, false, "");
      expect(m.kind).toBe("cuelira-denied");
    }
    const m = { kind: "requestInsight" };
    enforceSdkPolicy(m, true, "");
    expect(m.kind).toBe("cuelira-denied");
  });
});
