import type { CameraChoice, CameraProfile, CameraReport } from "../sdk/camera";

export function CameraReadings({ report }: { report: CameraReport }) {
  return <dl className="camera-readings" aria-label="Camera delivery diagnostics">
    <div><dt>Selected camera</dt><dd>{report.label}</dd></div>
    <div><dt>Negotiated resolution</dt><dd>{report.width && report.height ? `${report.width} × ${report.height}` : "Not reported"}</dd></div>
    <div><dt>Requested / negotiated FPS</dt><dd>{report.requestedFps} / {report.negotiatedFps?.toFixed(1) ?? "Not reported"}</dd></div>
    <div><dt>Measured preview FPS (before SDK)</dt><dd>{report.measuredFps?.toFixed(1) ?? "Measuring…"}</dd></div>
    <div><dt>Lowest 2-second window</dt><dd>{report.lowestWindowFps?.toFixed(1) ?? "Measuring…"} FPS ({report.windows}/4)</dd></div>
    {report.sdkFps !== undefined && <div><dt>SDK input callbacks / second</dt><dd>{report.sdkFps.toFixed(1)} (last 2 seconds)</dd></div>}
  </dl>;
}

export function CameraSetup({ devices, device, profile, report, active, busy, consent,
  onDevice, onProfile, onCheck, onStop, onRefresh, onStart,
}: {
  devices: CameraChoice[]; device: string; profile: CameraProfile;
  report: CameraReport | null; active: boolean; busy: boolean; consent: boolean;
  onDevice(value: string): void; onProfile(value: CameraProfile): void;
  onCheck(): void; onStop(): void; onRefresh(): void; onStart(): void;
}) {
  const checked = report?.phase === "checked" && active;
  return <section className="camera-check" aria-label="Camera readiness and selection">
    <h3>Check your camera before SmartSpectra</h3>
    <p className="small">Temporary local check: 1 second to warm up, then 8 seconds counting delivered preview frames. No frames are recorded, saved or uploaded by this check. Keep Cuelira and its preview visible.</p>
    <div className="camera-fields">
      <label>Camera
        <select value={device} onChange={e => onDevice(e.target.value)} disabled={active || busy || !consent}>
          <option value="">System default (check the preview)</option>
          {device && !devices.some(d => d.id === device) && <option value={device}>Previously selected camera (unavailable)</option>}
          {devices.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </label>
      <label>Capture target
        <select value={profile} onChange={e => onProfile(e.target.value as CameraProfile)} disabled={active || busy || !consent}>
          <option value="720p">1280 × 720 / 30 FPS (SDK default)</option>
          <option value="480p">640 × 480 / 30 FPS (compare delivery)</option>
        </select>
      </label>
    </div>
    {report && <>
      <CameraReadings report={report} />
      <p className="small" role="status">{report.phase === "stopped" ? "Camera off. Last check shown; check again before starting." : checked
        ? report.ready ? "Camera delivery check passed. SDK validation and genuine metrics are still required."
          : "Low FPS. SmartSpectra has not started. Target 30 FPS; all four windows need at least 25 FPS."
        : "Measuring delivered FPS…"}</p>
      <p className="small">{report.warning}</p>
    </>}
    <div className="actions">
      {!active && <button disabled={!consent || busy} onClick={onCheck}>{devices.length ? "Check selected camera" : "Enable camera"}</button>}
      {active && <button onClick={onStop}>{busy ? report?.phase === "capturing" ? "Cancel SDK startup" : "Cancel camera check" : "Stop camera"}</button>}
      {devices.length > 0 && <button disabled={!consent || busy || active} onClick={onRefresh}>Refresh cameras</button>}
      <button className="primary" disabled={busy || !checked || !report?.ready} onClick={onStart}>Start SmartSpectra</button>
    </div>
    <p className="small">Stop before changing camera or capture target. For low FPS, improve front lighting and close other camera or heavy apps. If Dell stays slow, choose the Samsung when Windows lists it, or another 30-FPS webcam. A lower resolution does not guarantee higher FPS.</p>
  </section>;
}
