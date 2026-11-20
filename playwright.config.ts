import { defineConfig } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
const cache = path.join(process.env.HOME ?? "", ".cache/ms-playwright");
const existing = existsSync(cache)
  ? readdirSync(cache)
      .filter((n) => /^chromium-\d+$/.test(n))
      .sort()
      .reverse()
      .map((n) => path.join(cache, n, "chrome-linux64/chrome"))
      .find(existsSync)
  : undefined;
export default defineConfig({
  testDir: "./tests/gui",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1360, height: 860 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || existing,
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
