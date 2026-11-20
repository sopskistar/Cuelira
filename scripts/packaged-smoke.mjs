import { _electron as electron } from "@playwright/test";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts/screenshots", { recursive: true });
const app = await electron.launch({
  executablePath: path.resolve("release/linux-unpacked/cuelira"),
  args: ["--no-sandbox"],
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
  await page.screenshot({
    path: "artifacts/screenshots/packaged-linux-welcome.png",
    fullPage: true,
  });
  await writeFile(
    "artifacts/packaged-smoke.json",
    JSON.stringify(
      {
        platform: runtime.platform,
        sdkAvailable: runtime.sdkAvailable,
        cameraTested: false,
        credentialConfigured: runtime.keyConfigured,
      },
      null,
      2,
    ),
  );
  console.log(
    "Packaged Linux app launched and loaded the bundled native SDK. Camera/authentication not tested.",
  );
} finally {
  await app.close();
}
