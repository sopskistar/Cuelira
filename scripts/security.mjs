import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const secrets = [
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{40,}/g,
  /sk-(?:proj-)?[A-Za-z0-9_-]{30,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];
const forbidden =
  /(^|\/)(?:\.env(?:\..*)?|node_modules|recordings|private|footage|release|dist|dist-electron|artifacts)(\/|$)|\.(?:mp4|webm|db|sqlite)$/;
const findings = [];
for (const file of tracked) {
  if (file === ".env.example") continue;
  if (forbidden.test(file))
    findings.push(`${file}: private/build/media file tracked`);
  const size = (await stat(file)).size;
  if (size > 10 * 1024 * 1024) findings.push(`${file}: exceeds 10 MB`);
  if (size > 2 * 1024 * 1024 || /\.(?:png|ico|woff2?)$/.test(file)) continue;
  const text = await readFile(file, "utf8");
  if (
    secrets.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    })
  )
    findings.push(`${file}: possible secret pattern (value suppressed)`);
  if (
    /PRESAGE_API_KEY\s*=\s*[A-Za-z0-9_-]{20,}/.test(text) &&
    !file.endsWith(".md") &&
    file !== "scripts/security.mjs"
  )
    findings.push(
      `${file}: possible assigned developer credential (value suppressed)`,
    );
}
console.log(
  `Scanned ${tracked.length} tracked files: ${findings.length} findings. Heuristic scan; not a guarantee that arbitrary credentials are absent.`,
);
findings.forEach((f) => console.log(f));
if (findings.length) process.exitCode = 1;
