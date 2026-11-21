import { build } from "esbuild";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
const require = createRequire(import.meta.url);
if (require("@smartspectra/node-sdk/package.json").version !== "3.5.0")
  throw new Error("This diagnostic is pinned to SDK 3.5.0. Re-inspect the pipeline before upgrading.");
const output = path.resolve("artifacts/sdk-probe");
await mkdir(output, { recursive: true });
await build({ entryPoints: ["tools/sdk-probe/main.ts"], outfile: path.join(output, "main.cjs"),
  bundle: true, platform: "node", format: "cjs", target: "node22",
  external: ["electron", "@smartspectra/node-sdk", "@smartspectra/node-sdk/*"] });
await build({ entryPoints: ["tools/sdk-probe/renderer.ts"], outfile: path.join(output, "renderer.js"),
  bundle: true, platform: "browser", format: "iife", target: "chrome130" });
const custom = await build({ entryPoints: ["tools/sdk-probe/preload.ts"], bundle: true,
  platform: "node", format: "cjs", external: ["electron"], write: false });
const official = await readFile(require.resolve("@smartspectra/node-sdk/preload"), "utf8");
await writeFile(path.join(output, "preload.cjs"), `(()=>{${official}\n})();\n(()=>{${custom.outputFiles[0].text}\n})();`);
await copyFile("tools/sdk-probe/index.html", path.join(output, "index.html"));
await copyFile("tools/sdk-probe/probe.css", path.join(output, "probe.css"));
if (!process.argv.includes("--build-only")) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require("electron"), [path.join(output, "main.cjs"), ...process.argv.slice(2)], { stdio: "inherit", env });
  child.on("error", () => { console.error("Probe could not launch Electron."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
