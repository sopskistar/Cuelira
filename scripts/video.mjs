import {
  mkdir,
  readFile,
  copyFile,
  symlink,
  access,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "..");
const video = path.join(root, "video");
const shared =
  process.env.CUELIRA_VIDEO_STUDIO ||
  path.join(os.homedir(), "hackathon-video-studio");
let modules = path.join(video, "node_modules");
try {
  await access(modules);
} catch {
  try {
    await access(path.join(shared, "node_modules/remotion"));
    await symlink(path.join(shared, "node_modules"), modules, "junction");
  } catch {
    throw new Error(
      "Run npm install in video/ or set CUELIRA_VIDEO_STUDIO to the existing shared workspace.",
    );
  }
}
await mkdir(path.join(video, "public/generated"), { recursive: true });
await mkdir(path.join(video, "footage"), { recursive: true });
await mkdir(path.join(video, "render"), { recursive: true });
try {
  await symlink(
    path.join(video, "footage"),
    path.join(video, "public/footage"),
    "junction",
  );
} catch (e) {
  if (e.code !== "EEXIST") throw e;
}
for (const asset of ["video-intro.svg", "video-outro.svg"])
  await copyFile(
    path.join(root, "assets/brand", asset),
    path.join(video, "public/generated", asset),
  );
await copyFile(
  path.join(
    root,
    "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff",
  ),
  path.join(video, "public/generated/barlow.woff"),
);
const mode = process.argv[2] || "studio";
const args =
  mode === "studio"
    ? ["studio", "src/index.tsx", "--no-open", "--port=3100"]
    : [
        "render",
        "src/index.tsx",
        mode === "proof" ? "BrandProof" : "CueliraDemo",
        mode === "proof"
          ? "render/cuelira-brand-proof.mp4"
          : "render/cuelira-demo.mp4",
        "--codec=h264",
        "--concurrency=2",
      ];
if (mode === "render") {
  const manifest = JSON.parse(
    await readFile(path.join(video, "manifest.json"), "utf8"),
  );
  if (!manifest.liveVerified || !manifest.captureEvidence)
    throw new Error(
      "Final demo blocked: genuine Windows camera acceptance and inspected footage are required. See docs/DEMO_STORYBOARD.md.",
    );
  if (!/^[a-zA-Z0-9_-]+\.mp4$/.test(manifest.footage))
    throw new Error("Expected a local MP4 filename");
  const source = path.join(video, "footage", manifest.footage);
  await access(source);
  const duration = Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=nw=1:nk=1",
        source,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
  if (duration < manifest.minimumSeconds)
    throw new Error(
      "Footage is shorter than the authored 70-second segment. Retiming is required.",
    );
}
const command =
  process.platform === "win32"
    ? path.join(modules, ".bin/remotion.cmd")
    : path.join(modules, ".bin/remotion");
const child = spawn(command, args, {
  cwd: video,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
