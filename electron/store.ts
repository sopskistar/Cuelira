import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  unlink,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import { TakeSchema, type Take, report } from "../src/core/model";
export class TakeStore {
  private saving: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}
  file(id: string, extension = "json") {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new Error("Invalid take ID");
    return path.join(this.directory, `${id}.${extension}`);
  }
  async read(id: string): Promise<Take> {
    return TakeSchema.parse(JSON.parse(await readFile(this.file(id), "utf8")));
  }
  async save(input: unknown): Promise<void> {
    const take = TakeSchema.parse(input);
    const serialized = JSON.stringify(take, null, 2);
    const next = this.saving
      .catch(() => {})
      .then(async () => {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        await writeFile(this.file(take.id, "tmp"), serialized, { mode: 0o600 });
        await rename(this.file(take.id, "tmp"), this.file(take.id));
      });
    this.saving = next;
    return next;
  }
  async list() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const names = (await readdir(this.directory)).filter((n) =>
      n.endsWith(".json"),
    );
    const results = await Promise.allSettled(
      names.map((n) => this.read(n.slice(0, -5))),
    );
    return results
      .flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
      .sort((a, b) => b.startedAt - a.startedAt);
  }
  async delete(id: string) {
    await this.saving.catch(() => {});
    for (const ext of ["webm", "json", "tmp"]) {
      try {
        await unlink(this.file(id, ext));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
  }
  async recoverInterrupted() {
    for (const take of await this.list()) {
      if (take.status !== "rehearsing") continue;
      const at = take.events.at(-1)?.at ?? take.startedAt;
      take.status = "stopped";
      take.endedAt = at;
      take.events.push({
        type: "stopped",
        at,
        beat: take.events.at(-1)?.beat ?? 0,
        detail:
          "Recovered an interrupted take after application restart. End time is the last saved event; exact interruption time is unknown.",
      });
      await this.save(take);
    }
  }
  async video(id: string, bytes: ArrayBuffer) {
    const take = await this.read(id);
    if (!take.recordingConsent) throw new Error("Recording was not consented");
    if (
      !(bytes instanceof ArrayBuffer) ||
      !bytes.byteLength ||
      bytes.byteLength > 150 * 1024 * 1024
    )
      throw new Error("Recording exceeds 150 MB limit or is empty");
    const data = Buffer.from(bytes);
    if (!data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))
      throw new Error("Expected a WebM recording");
    await writeFile(this.file(id, "webm"), data, { mode: 0o600 });
    take.recordingSaved = true;
    await this.save(take);
  }
  async export(
    id: string,
    format: "json" | "txt" | "webm",
    destination: string,
  ) {
    const take = await this.read(id);
    if (format === "webm") {
      if (!take.recordingSaved) throw new Error("No recording for this take");
      await copyFile(this.file(id, "webm"), destination);
    } else
      await writeFile(
        destination,
        format === "json" ? JSON.stringify(take, null, 2) : report(take),
      );
  }
}
