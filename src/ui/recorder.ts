export class TakeRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private size = 0;
  start(
    stream: MediaStream,
    consent: boolean,
    onFailure: (message: string) => void,
  ) {
    if (!consent) throw new Error("Separate recording consent is required");
    const mimeType = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType)
      throw new Error("WebM recording is not supported on this device");
    this.chunks = [];
    this.size = 0;
    const recorder = (this.recorder = new MediaRecorder(
      new MediaStream(stream.getVideoTracks()),
      { mimeType, videoBitsPerSecond: 2_000_000 },
    ));
    recorder.ondataavailable = (event) => {
      this.size += event.data.size;
      if (this.size > 140 * 1024 * 1024) {
        onFailure(
          "Recording stopped at the 140 MB safety limit. The scene report is still available.",
        );
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      if (event.data.size) this.chunks.push(event.data);
    };
    recorder.onerror = () =>
      onFailure("Recording failed. The scene event report remains available.");
    recorder.start(1000);
  }
  async stop(): Promise<Blob | null> {
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder) return null;
    if (recorder.state !== "inactive")
      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.stop();
      });
    const blob = this.chunks.length
      ? new Blob(this.chunks, { type: "video/webm" })
      : null;
    this.chunks = [];
    return blob;
  }
}
