import { build } from "esbuild";
import { build as vite } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
await mkdir("dist-electron", { recursive: true });
await build({
  entryPoints: ["electron/main.ts"],
  outfile: "dist-electron/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron", "@smartspectra/node-sdk", "@smartspectra/node-sdk/*"],
  target: "node22",
});
// A sandboxed Electron preload cannot require arbitrary packages. Bundle the
// official preload verbatim into the isolated preload alongside our narrow API.
const official = await readFile(
  require.resolve("@smartspectra/node-sdk/preload"),
  "utf8",
);
const custom = await build({
  entryPoints: ["electron/preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  write: false,
  target: "node22",
});
await writeFile(
  "dist-electron/preload.cjs",
  `(()=>{${official}\n})();\n(()=>{${custom.outputFiles[0].text}\n})();`,
);
await vite();
