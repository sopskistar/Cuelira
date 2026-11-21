import { test, expect, _electron } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("manual journey is honest, complete, exportable and deletable", async ({
  page,
}) => {
  await mkdir("artifacts/screenshots", { recursive: true });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your scene responds to you." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/welcome-1360.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start a rehearsal" }).click();
  await expect(
    page.getByRole("button", { name: "Enable camera" }),
  ).toBeDisabled();
  await expect(page.getByRole("checkbox").nth(1)).not.toBeChecked();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Enable camera" }).click();
  await expect(page.getByRole("alert")).toContainText("native Electron");
  await page.screenshot({
    path: "artifacts/screenshots/consent-browser-error.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Rehearse manually, camera off" })
    .click();
  await page.getByRole("button", { name: "Begin the scene" }).click();
  await expect(
    page.getByText("Manual rehearsal (no SDK recognition)"),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/stage-manual-1360.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pause scene" }).click();
  await expect(
    page.getByRole("button", { name: "Continue manually" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Resume scene" }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Continue manually" }).click();
    if (i === 0)
      await expect(page.locator(".scene-announcement")).toContainText(
        "I knew you would leave if you read it",
      );
  }
  await expect(page.getByText("Scene complete", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finish & review take" }).click();
  await expect(
    page.getByRole("heading", { name: "A take to look back on." }),
  ).toBeVisible();
  await expect(
    page.getByText("Manual continuation", { exact: true }),
  ).toHaveCount(3);
  await expect(page.getByText("0 of 3")).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/review-manual-1360.png",
    fullPage: true,
  });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON events" }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/Cuelira-.*\.json/);
  await page.getByRole("button", { name: "Delete take", exact: true }).click();
  await page.getByRole("button", { name: "Keep take" }).click();
  await page.getByRole("button", { name: "Delete take", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByRole("heading", { name: "Your first take starts here." }),
  ).toBeVisible();
});
test("minimum desktop size, keyboard, privacy and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 680 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  // Route heading receives focus; Tab moves forward into its primary action.
  await expect(
    page.getByRole("button", { name: "Start a rehearsal" }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/screenshots/welcome-960.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Privacy & consent" }).click();
  await expect(
    page.getByRole("heading", { name: "Your camera. Your take. Your choice." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to studio" }).click();
  await page.getByRole("button", { name: "Start a rehearsal" }).click();
  await page
    .getByRole("button", { name: "Rehearse manually, camera off" })
    .click();
  await page.getByRole("button", { name: "Begin the scene" }).click();
  await page.screenshot({
    path: "artifacts/screenshots/stage-manual-960.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".dialogue")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "End & save take" }).click();
  await expect(
    page.getByRole("heading", { name: "A take, saved so far." }),
  ).toBeVisible();
});
test("native Electron launches with secure defaults, no key, and persists manual take", async () => {
  test.setTimeout(60000);
  const app = await _electron.launch({
    args: [".", "--no-sandbox", "--use-fake-device-for-media-stream=fps=30"],
    env: {
      ...process.env,
      PRESAGE_API_KEY: "",
      SMARTSPECTRA_API_KEY: "",
      CUELIRA_TEST_USER_DATA: path.resolve("artifacts/electron-test-data"),
    },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByRole("heading", { name: "Your scene responds to you." }),
    ).toBeVisible();
    const globals = await page.evaluate(() => ({
      require: typeof (window as any).require,
      process: typeof (window as any).process,
    }));
    expect(globals).toEqual({ require: "undefined", process: "undefined" });
    const runtime = await page.evaluate(() => window.cuelira!.info());
    expect(runtime.desktop).toBe(true);
    expect(runtime.keyConfigured).toBe(false);
    expect(runtime.sdkAvailable).toBe(true);
    // Chromium fake camera only: exercise the actual Electron handlers without
    // requiring hardware or opening a user's real webcam on a developer machine.
    expect(await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        return "unexpectedly allowed";
      } catch (error) { return (error as DOMException).name; }
    })).toBe("NotAllowedError");
    await page.screenshot({
      path: "artifacts/screenshots/electron-welcome.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Start a rehearsal" }).click();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Enable camera" }).click();
    await expect(page.getByText("Camera delivery check passed.", { exact: false })).toBeVisible({ timeout: 15000 })
      .catch(async error => {
        await page.screenshot({ path: "artifacts/screenshots/electron-camera-failure-fixture.png", fullPage: true });
        throw new Error(`${error}\nCamera UI: ${await page.locator("main").innerText()}`);
      });
    await page.screenshot({ path: "artifacts/screenshots/electron-camera-check-fixture.png", fullPage: true });
    await page.getByRole("button", { name: "Start SmartSpectra" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Developer key missing",
    );
    await page
      .getByRole("button", { name: "Rehearse manually, camera off" })
      .click();
    await page.getByRole("button", { name: "Begin the scene" }).click();
    for (let i = 0; i < 3; i++)
      await page.getByRole("button", { name: "Continue manually" }).click();
    await page.getByRole("button", { name: "Finish & review take" }).click();
    await expect(
      page.getByRole("heading", { name: "A take to look back on." }),
    ).toBeVisible();
    const saved = await page.evaluate(() => window.cuelira!.list());
    expect(
      saved.some((t) => t.mode === "manual" && t.status === "completed"),
    ).toBe(true);
    const id = saved.find(
      (t) => t.mode === "manual" && t.status === "completed",
    )!.id;
    await page.reload();
    expect(
      (await page.evaluate(() => window.cuelira!.list())).some(
        (t) => t.id === id,
      ),
    ).toBe(true);
    await page.evaluate((id) => window.cuelira!.delete(id), id);
    expect(
      (await page.evaluate(() => window.cuelira!.list())).some(
        (t) => t.id === id,
      ),
    ).toBe(false);
    await page.screenshot({
      path: "artifacts/screenshots/electron-after-reload.png",
      fullPage: true,
    });
  } finally {
    await app.close();
  }
});
