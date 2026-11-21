import { SmartSpectraErrorCode as Code } from "@smartspectra/node-sdk/renderer";

// Fixed, actionable text: native diagnostics may contain paths or credentials.
export function sdkFailure(code: unknown, retryable = false): string {
  if (code === Code.kSustainedLowFrameRate)
    return "SmartSpectra error 14 — sustained low frame rate (kSustainedLowFrameRate). The SDK could not sustain reliable processing; advertised webcam FPS alone does not establish processing throughput. Use the native physical built-in/USB webcam acceptance test; Presage does not support virtual or connected-phone cameras. Target sustained 25+ FPS, preferably 30. Start again yourself after the check; no automatic retry.";
  if (code === Code.kAuthenticationFailed)
    return "SmartSpectra authentication failed (2). Check your private developer key and its access, then restart Cuelira. Never share the key.";
  if (code === Code.kMetricNotAuthorized)
    return "SmartSpectra facial metrics are not authorized (13). Check face-metric access on your Presage account.";
  if (code === Code.kCreditExhausted)
    return "SmartSpectra usage credit exhausted (4). Check your Presage account allowance.";
  if (code === Code.kNetworkError || code === Code.kServerError)
    return "SmartSpectra service connection failed. Check network access to Presage and retry manually.";
  if (code === Code.kNonMonotonicTimestamp || code === Code.kTimestampGap)
    return `SmartSpectra frame timing error (${code}). Stop capture and recheck the camera in the foreground. Restart Cuelira if it repeats; frame timestamps are managed by the official SDK.`;
  if (code === "SMARTSPECTRA_IPC_TIMEOUT")
    return "SmartSpectra IPC timeout. The native process did not respond. Stop capture and restart Cuelira; reduce other processing load.";
  if (code === Code.kInputUnavailable)
    return "SmartSpectra camera input unavailable (7). Reconnect the selected camera and recheck camera readiness.";
  return `Camera or SmartSpectra startup failed (${typeof code === "number" ? code : "initialization"}). ${retryable ? "Stop and retry manually." : "Stop and check the SDK configuration; restart Cuelira if it repeats."}`;
}
