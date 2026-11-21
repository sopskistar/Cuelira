// Metadata only. Never retain a frame buffer, absolute timestamp, device ID or key.
export class FrameAudit {
  private count = 0;
  private bytes = 0;
  private width = 0;
  private height = 0;
  private firstTs: number | null = null;
  private lastTs: number | null = null;
  private badOrder = 0;
  private maxGapMs = 0;
  private handlerStart: number | null = null;
  private handlerSum = 0;
  private handlerMax = 0;
  private handlers = 0;
  private start: number;
  constructor(private now = () => performance.now()) { this.start = now(); }
  before(data: Record<string, unknown>) {
    if (data.kind !== "frame") return;
    this.handlerStart = this.now();
    this.count++;
    const buffer = data.buffer as { byteLength?: number } | undefined;
    this.bytes += typeof buffer?.byteLength === "number" ? buffer.byteLength : 0;
    this.width = Number(data.width) || 0;
    this.height = Number(data.height) || 0;
    const ts = data.timestampUs;
    if (typeof ts !== "number" || !Number.isFinite(ts)) return;
    if (this.firstTs === null) this.firstTs = ts;
    if (this.lastTs !== null) {
      if (ts <= this.lastTs) this.badOrder++;
      this.maxGapMs = Math.max(this.maxGapMs, (ts - this.lastTs) / 1000);
    }
    this.lastTs = ts;
  }
  after(data: Record<string, unknown>) {
    if (data.kind !== "frame" || this.handlerStart === null) return;
    const elapsed = this.now() - this.handlerStart;
    this.handlerSum += elapsed;
    this.handlerMax = Math.max(this.handlerMax, elapsed);
    this.handlers++;
    this.handlerStart = null;
  }
  sample() {
    const end = this.now();
    const seconds = (end - this.start) / 1000;
    const span = this.firstTs !== null && this.lastTs !== null ? this.lastTs - this.firstTs : 0;
    const result = {
      elapsedSeconds: seconds,
      mainFramesHandledPerSecond: seconds > 0 ? this.count / seconds : 0,
      payloadMiBPerSecond: seconds > 0 ? this.bytes / 1048576 / seconds : 0,
      width: this.width, height: this.height,
      timestampCadenceFps: span > 0 ? (this.count - 1) * 1000000 / span : null,
      nonIncreasingTimestamps: this.badOrder, maxTimestampGapMs: this.maxGapMs,
      synchronousHandlerMeanMs: this.handlers ? this.handlerSum / this.handlers : null,
      synchronousHandlerMaxMs: this.handlers ? this.handlerMax : null,
    };
    this.count = this.bytes = this.badOrder = this.maxGapMs = 0;
    this.firstTs = this.lastTs = null;
    this.handlerSum = this.handlerMax = this.handlers = 0;
    this.start = end;
    return result;
  }
}
