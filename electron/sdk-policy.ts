// The public SDK bridge exposes no main-side credential/configuration callback.
// This Electron MessagePort policy runs BEFORE its listener, leaving official
// capture/IPC/native lifecycle intact. Wire contract is pinned and tested for 3.5.0.
export function enforceSdkPolicy(
  message: Record<string, unknown>,
  consent: boolean,
  apiKey: string,
) {
  const kind = message.kind;
  if (!consent && !["stop", "destroy", "reset"].includes(String(kind))) {
    message.kind = "cuelira-denied";
    return;
  }
  if (kind === "configure")
    message.options = {
      apiKey,
      requestedMetrics: [11, 12, 13, 14],
      enableAccumulatedOutput: false,
      enableTelemetry: false,
    };
  // This product never sends prompts to an external insights service.
  if (kind === "requestInsight") message.kind = "cuelira-denied";
}
