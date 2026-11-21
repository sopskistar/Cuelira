import { test, expect } from "@playwright/test";

test("camera selection and readiness using explicitly synthetic browser camera fixtures", async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const fixture = { consent: false, streams: [] as MediaStream[], requests: [] as MediaStreamConstraints[] };
    (window as any).cameraFixture = fixture;
    (window as any).cuelira = {
      info: async () => ({ desktop: true, sdkAvailable: true, keyConfigured: false, platform: "AUTOMATED FIXTURE", storage: "No saved diagnostic data" }),
      list: async () => [],
      consent: async (value: boolean) => { fixture.consent = value; },
    };
    Object.defineProperty(navigator, "mediaDevices", { value: {
      enumerateDevices: async () => fixture.consent ? [
        { kind: "videoinput", deviceId: "dell-test", label: "Dell camera (synthetic 10 FPS fixture)" },
        { kind: "videoinput", deviceId: "phone-test", label: "Samsung camera (synthetic 30 FPS fixture)" },
        { kind: "audioinput", deviceId: "mic-test", label: "Should never appear" },
      ] : [],
      getUserMedia: async (constraints: MediaStreamConstraints) => {
        if (!fixture.consent) throw new DOMException("Fixture consent required", "NotAllowedError");
        fixture.requests.push(constraints);
        const camera = constraints.video as MediaTrackConstraints;
        const phone = (camera.deviceId as ConstrainDOMStringParameters)?.exact === "phone-test";
        const fps = phone ? 30 : 10;
        const canvas = document.createElement("canvas");
        canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        let count = 0;
        const draw = () => {
          ctx.fillStyle = phone ? "#214c38" : "#303646";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#ffffff"; ctx.font = "20px sans-serif";
          ctx.fillText("AUTOMATED CAMERA FIXTURE — NO FACE", 35, 200);
          ctx.fillText(`${phone ? "Phone" : "Dell"} / ${fps} FPS / frame ${count++}`, 35, 240);
        };
        draw();
        const stream = canvas.captureStream(fps);
        const timer = setInterval(draw, 1000 / fps);
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings.bind(track);
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(timer); stop(); };
        track.getSettings = () => ({ ...settings(), deviceId: phone ? "phone-test" : "dell-test" });
        Object.defineProperty(track, "label", { value: phone ? "Samsung camera (synthetic 30 FPS fixture)" : "Dell camera (synthetic 10 FPS fixture)" });
        fixture.streams.push(stream);
        return stream;
      },
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start a rehearsal" }).click();
  const panel = page.getByRole("region", { name: "Camera readiness and selection" });
  await expect(panel.getByRole("button", { name: "Enable camera" })).toBeDisabled();
  expect(await page.evaluate(() => (window as any).cameraFixture.requests.length)).toBe(0);
  await page.getByRole("checkbox").first().check();
  await panel.getByRole("button", { name: "Enable camera" }).click();
  await expect(panel.getByText("Low FPS.", { exact: false })).toBeVisible({ timeout: 15000 });
  await expect(panel.getByRole("button", { name: "Start SmartSpectra" })).toBeDisabled();
  await expect(panel.getByRole("combobox", { name: "Camera", exact: true })).toBeDisabled();
  await page.screenshot({ path: "artifacts/screenshots/camera-low-fps-fixture-1360.png", fullPage: true });
  await panel.getByRole("button", { name: "Stop camera" }).click();
  expect(await page.evaluate(() => (window as any).cameraFixture.streams[0].getTracks()[0].readyState)).toBe("ended");
  await panel.getByRole("button", { name: "Refresh cameras" }).click();
  await panel.getByRole("combobox", { name: "Camera", exact: true }).selectOption("phone-test");
  await panel.getByRole("combobox", { name: "Capture target" }).selectOption("480p");
  await panel.getByRole("button", { name: "Check selected camera" }).click();
  await expect(panel.getByText("Camera delivery check passed.", { exact: false })).toBeVisible({ timeout: 15000 });
  await expect(panel.getByRole("button", { name: "Start SmartSpectra" })).toBeEnabled();
  const requests = await page.evaluate(() => (window as any).cameraFixture.requests);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toMatchObject({ audio: false, video: { deviceId: { exact: "phone-test" }, frameRate: { ideal: 30 } } });
  await page.screenshot({ path: "artifacts/screenshots/camera-ready-fixture-1360.png", fullPage: true });
  await page.setViewportSize({ width: 960, height: 680 });
  await page.screenshot({ path: "artifacts/screenshots/camera-ready-fixture-960.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Missing key is checked separately after camera readiness, before SDK construction.
  await panel.getByRole("button", { name: "Start SmartSpectra" }).click();
  await expect(page.getByRole("alert")).toContainText("Developer key missing");
  expect(await page.evaluate(() => (window as any).cameraFixture.streams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === "ended")))).toBe(true);
  await panel.getByRole("button", { name: "Check selected camera" }).click();
  await panel.getByRole("button", { name: "Cancel camera check" }).click();
  await expect(panel.getByRole("button", { name: "Check selected camera" })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).cameraFixture.streams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === "ended")))).toBe(true);
});
