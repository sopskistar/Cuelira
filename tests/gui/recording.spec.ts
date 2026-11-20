import { test, expect } from "@playwright/test";
test("recording module creates playable WebM from an explicitly synthetic canvas", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    // Dynamic Vite import exercises the shipped recorder without a camera.
    const modulePath = "/src/ui/recorder.ts";
    const { TakeRecorder } = await import(/* @vite-ignore */ modulePath);
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(15);
    const recorder = new TakeRecorder();
    let denied = false;
    try {
      recorder.start(stream, false, () => {});
    } catch {
      denied = true;
    }
    const errors: string[] = [];
    recorder.start(stream, true, (message: string) => errors.push(message));
    const timer = setInterval(() => {
      ctx.fillStyle = "#151919";
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#c7ddac";
      ctx.fillRect(Date.now() % 250, 50, 30, 30);
    }, 60);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const blob: Blob = await recorder.stop();
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    const video = document.createElement("video");
    video.muted = true;
    const url = URL.createObjectURL(blob);
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("WebM did not decode"));
      video.load();
    });
    const result = {
      denied,
      errors,
      size: blob.size,
      width: video.videoWidth,
      height: video.videoHeight,
    };
    URL.revokeObjectURL(url);
    return result;
  });
  expect(result.denied).toBe(true);
  expect(result.errors).toEqual([]);
  expect(result.size).toBeGreaterThan(1000);
  expect(result.width).toBe(320);
  expect(result.height).toBe(180);
});
