import { test, expect, _electron } from "@playwright/test";
import path from "node:path";

test("native Electron independent probe: real handlers with an explicitly fake camera, no key or recognition", async () => {
  test.setTimeout(60000);
  const app = await _electron.launch({
    args: [path.resolve("artifacts/sdk-probe/main.cjs"), "--no-sandbox", "--use-fake-device-for-media-stream=fps=30"],
    env: { ...process.env, PRESAGE_API_KEY: "", SMARTSPECTRA_API_KEY: "",
      CUELIRA_TEST_USER_DATA: path.resolve("artifacts/probe-test-data") },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Independent SmartSpectra 3.5.0 probe" })).toBeVisible();
    const runtime = await page.evaluate(() => (window as any).sdkProbe.info());
    expect(runtime).toMatchObject({ sdk: "3.5.0", keyConfigured: false, runtimeAvailable: true, mainAudit: true });
    expect(runtime).not.toHaveProperty("apiKey");
    expect(await page.evaluate(() => ({ require: typeof (window as any).require, process: typeof (window as any).process })))
      .toEqual({ require: "undefined", process: "undefined" });
    await expect(page.getByRole("button", { name: "Open selected camera" })).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Open selected camera" }).click();
    await expect(page.getByRole("button", { name: "Start official SDK" })).toBeEnabled();
    await expect(page.locator("#report")).toContainText("negotiatedFps");
    await page.getByRole("button", { name: "Start official SDK" }).click();
    await expect(page.getByRole("status")).toContainText("Private key or native runtime unavailable");
    await expect(page.getByRole("button", { name: "Open selected camera" })).toBeEnabled();
    expect(await page.locator("#preview").evaluate((v: HTMLVideoElement) => v.srcObject)).toBeNull();
    await page.getByRole("button", { name: "Show sanitized report for copying" }).click();
    const output = await page.locator("#snapshot-text").inputValue();
    expect(output).not.toMatch(/apiKey|deviceId|groupId|timestampUs|"buffer"/);
    expect(output).toContain("No frames included");
    await page.screenshot({ path: "artifacts/screenshots/sdk-probe-fake-camera-no-key.png", fullPage: true });
  } finally { await app.close(); }
});
