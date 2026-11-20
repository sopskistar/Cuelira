import { _electron as electron } from "@playwright/test";
import path from "node:path";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts/screenshots", { recursive: true });
const app = await electron.launch({
  executablePath: path.resolve(
    process.platform === "win32"
      ? "release/win-unpacked/Cuelira.exe"
      : "release/linux-unpacked/cuelira",
  ),
  args: process.platform === "linux" ? ["--no-sandbox"] : [],
  env: {
    ...process.env,
    PRESAGE_API_KEY: "",
    SMARTSPECTRA_API_KEY: "",
    CUELIRA_TEST_USER_DATA: path.resolve("artifacts/packaged-test-data"),
  },
});
try {
  const page = await app.firstWindow();
  await page
    .getByRole("heading", { name: "Your scene responds to you." })
    .waitFor();
  const runtime = await page.evaluate(() => window.cuelira.info());
  if (!runtime.sdkAvailable || !runtime.desktop)
    throw new Error("Packaged SDK library did not load");
  assert.equal(
    runtime.keyConfigured,
    false,
    "Smoke test must run without a real credential",
  );
  const globals = await page.evaluate(() => ({
    require: typeof window.require,
    process: typeof window.process,
  }));
  assert.deepEqual(globals, { require: "undefined", process: "undefined" });
  await page.screenshot({
    path: `artifacts/screenshots/packaged-${process.platform}-welcome.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start a rehearsal" }).click();
  await page
    .getByRole("button", { name: "Rehearse manually, camera off" })
    .click();
  await page.getByRole("button", { name: "Begin the scene" }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Continue manually" }).click();
  await page.getByRole("button", { name: "Finish & review take" }).click();
  await page
    .getByRole("heading", { name: "A take to look back on." })
    .waitFor();
  const saved = await page.evaluate(() => window.cuelira.list());
  const take = saved.find(
    (item) => item.status === "completed" && item.mode === "manual",
  );
  assert.ok(take, "Packaged app must save the actual manual take");
  assert.equal(
    take.events.filter((event) => event.type === "accepted").length,
    0,
  );
  assert.equal(
    take.events.filter((event) => event.type === "manual").length,
    3,
  );
  await page.screenshot({
    path: `artifacts/screenshots/packaged-${process.platform}-review.png`,
    fullPage: true,
  });
  await page.reload();
  assert.ok(
    (await page.evaluate(() => window.cuelira.list())).some(
      (item) => item.id === take.id,
    ),
  );
  await page.evaluate((id) => window.cuelira.delete(id), take.id);
  assert.equal(
    (await page.evaluate(() => window.cuelira.list())).some(
      (item) => item.id === take.id,
    ),
    false,
  );
  await writeFile(
    "artifacts/packaged-smoke.json",
    JSON.stringify(
      {
        platform: runtime.platform,
        sdkAvailable: runtime.sdkAvailable,
        cameraTested: false,
        credentialConfigured: runtime.keyConfigured,
        manualTakePersisted: true,
        manualTakeDeleted: true,
      },
      null,
      2,
    ),
  );
  console.log(
    `Packaged ${runtime.platform} app loaded the bundled SDK and completed/persisted/deleted a manual take. Camera/authentication not tested.`,
  );
} finally {
  await app.close();
}
