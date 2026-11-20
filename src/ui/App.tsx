import { useEffect, useRef, useState } from "react";
import { Rehearsal } from "../core/engine";
import {
  scene,
  closing,
  report,
  type Take,
  type Observation,
} from "../core/model";
import { LiveCapture } from "../sdk/live";
import type { RuntimeInfo } from "../bridge";
import { Icon, Mark } from "./Icon";
import { TakeRecorder } from "./recorder";

type Screen =
  | "welcome"
  | "consent"
  | "prepare"
  | "stage"
  | "review"
  | "takes"
  | "help"
  | "privacy";
const description =
  "Cuelira is a live self-tape rehearsal partner that uses Presage SmartSpectra to make scripted scenes respond to an actor's facial expressions and provide take-by-take feedback.";
const elapsed = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0")}`;
function download(take: Take, format: "json" | "txt") {
  const url = URL.createObjectURL(
    new Blob(
      [format === "json" ? JSON.stringify(take, null, 2) : report(take)],
      { type: format === "json" ? "application/json" : "text/plain" },
    ),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Cuelira-${take.id}.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Preview({
  stream,
  recording,
  compact = false,
}: {
  stream: MediaStream | null;
  recording: boolean;
  compact?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (video.current) {
      video.current.srcObject = stream;
      if (stream) void video.current.play().catch(() => {});
    }
  }, [stream]);
  return (
    <div className={`camera ${compact ? "compact" : ""}`}>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        aria-label="Your live camera preview"
        className={stream ? "" : "off"}
      />
      {!stream && (
        <div className="camera-empty">
          <Icon name="camera" size={36} />
          <h3>Camera is off</h3>
          <p>Your space. Your permission.</p>
        </div>
      )}
      <div className="camera-top">
        <span>{stream ? "Live camera" : "Camera off"}</span>
        <span className={recording ? "recording" : ""}>
          {recording ? "Recording video" : "Not recording"}
        </span>
      </div>
      {stream && <div className="frame-guide" aria-hidden="true" />}
      <span className="camera-bottom">
        {stream
          ? "Stay in frame. Keep your face evenly lit."
          : "No camera footage is being captured."}
      </span>
    </div>
  );
}
export function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [info, setInfo] = useState<RuntimeInfo | null>(null);
  const [cameraConsent, setCameraConsent] = useState(false);
  const [recordConsent, setRecordConsent] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sdkStatus, setSdkStatus] = useState("Camera off");
  const [observation, setObservation] = useState<Observation | null>(null);
  const [mode, setMode] = useState<"live" | "manual">("live");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [takes, setTakes] = useState<Take[]>([]);
  const [selected, setSelected] = useState<Take | null>(null);
  const [compare, setCompare] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [, redraw] = useState(0);
  const engine = useRef<Rehearsal | null>(null);
  const recorder = useRef(new TakeRecorder());
  const interruptedRecording = useRef<Promise<Blob | null> | null>(null);
  const [recording, setRecording] = useState(false);
  const capture = useRef<LiveCapture | null>(null);
  const finishing = useRef(false);
  const lastDisplay = useRef(0);
  if (!capture.current)
    capture.current = new LiveCapture({
      stream: setStream,
      status: setSdkStatus,
      observation: (o) => {
        engine.current?.observe(o, Date.now());
        if (Date.now() - lastDisplay.current > 100 || o.reason) {
          setObservation(o);
          lastDisplay.current = Date.now();
        }
      },
      error: (message) => {
        setError(message);
        engine.current?.fail(Date.now(), message);
        setRecording(false);
        interruptedRecording.current ??= recorder.current.stop();
        void capture.current?.stop().catch(() => {});
      },
    });
  useEffect(() => {
    if (window.cuelira) {
      void Promise.all([window.cuelira.info(), window.cuelira.list()])
        .then(([runtime, saved]) => {
          setInfo(runtime);
          setTakes(saved);
        })
        .catch(() =>
          setError(
            "Local take storage could not be read. Check application-data permissions.",
          ),
        );
    } else
      setInfo({
        desktop: false,
        sdkAvailable: false,
        keyConfigured: false,
        platform: "Browser preview",
        storage: "Temporary memory only. Open Electron for local persistence.",
      });
    return () => {
      void capture.current?.stop().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (screen !== "stage" && screen !== "prepare") return;
    const timer = setInterval(() => {
      engine.current?.tick(Date.now());
      redraw((n) => n + 1);
    }, 150);
    return () => clearInterval(timer);
  }, [screen]);
  useEffect(() => {
    if (screen !== "stage" || !window.cuelira) return;
    const timer = setInterval(() => {
      if (!engine.current || finishing.current) return;
      void window
        .cuelira!.save(structuredClone(engine.current.take))
        .catch(() =>
          setError(
            "Take checkpoint could not be saved. Export or end the take and check storage permissions.",
          ),
        );
    }, 5000);
    return () => clearInterval(timer);
  }, [screen]);
  useEffect(() => {
    const title = document.querySelector<HTMLElement>("main h1, main h2");
    title?.focus();
  }, [screen]);
  useEffect(() => {
    setConfirmDelete(false);
    setCompare("");
  }, [selected?.id]);
  useEffect(() => {
    setVideoUrl(null);
    if (!selected?.recordingSaved || !window.cuelira) return;
    let active = true;
    let url: string | null = null;
    void window.cuelira
      .videoRead(selected.id)
      .then((bytes) => {
        if (active && bytes) {
          url = URL.createObjectURL(
            new Blob([new Uint8Array(bytes)], { type: "video/webm" }),
          );
          setVideoUrl(url);
        }
      })
      .catch(() =>
        setError(
          "Saved video could not be opened. The event report remains available.",
        ),
      );
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selected?.id, selected?.recordingSaved]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The action failed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const startCamera = () =>
    run(async () => {
      if (!cameraConsent) throw new Error("Camera consent is required");
      setObservation(null);
      await window.cuelira?.consent(true, recordConsent);
      try {
        await capture.current!.start();
      } catch (e) {
        await window.cuelira?.consent(false, false);
        throw e;
      }
      setMode("live");
      engine.current?.recover(Date.now());
      if (screen !== "stage") setScreen("prepare");
    });
  const manualPrep = () =>
    run(async () => {
      await capture.current!.stop();
      await window.cuelira?.consent(false, false);
      setObservation(null);
      setMode("manual");
      setRecordConsent(false);
      setScreen("prepare");
    });
  const begin = () =>
    run(async () => {
      if (mode === "live" && !ready)
        throw new Error(
          "Wait for a fresh, valid facial observation before starting.",
        );
      const e = (engine.current = new Rehearsal(
        recordConsent && mode === "live",
      ));
      e.take.mode = mode;
      e.start(Date.now());
      if (mode === "manual")
        e.take.events[0].detail =
          "Manual rehearsal started. No SmartSpectra recognition is claimed.";
      if (recordConsent && stream && mode === "live") {
        recorder.current.start(stream, true, setError);
        setRecording(true);
      }
      try {
        await window.cuelira?.save(e.take);
      } catch (err) {
        await recorder.current.stop();
        setRecording(false);
        e.stop(Date.now());
        throw err;
      }
      setSelected(null);
      setScreen("stage");
    });
  const finish = () =>
    run(async () => {
      if (finishing.current || !engine.current) return;
      finishing.current = true;
      const e = engine.current;
      try {
        if (e.phase !== "completed") e.stop(Date.now());
        // Finish recorder before stopping its camera tracks.
        const blob = await (interruptedRecording.current ??
          recorder.current.stop());
        interruptedRecording.current = null;
        setRecording(false);
        await capture
          .current!.stop()
          .catch(() =>
            setNotice(
              "Camera stopped; native teardown reported an error. Restart the application before a new live take.",
            ),
          );
        await window.cuelira?.save(e.take);
        if (blob && window.cuelira) {
          try {
            await window.cuelira.videoSave(e.take.id, await blob.arrayBuffer());
            e.take.recordingSaved = true;
          } catch {
            setError(
              "The video could not be saved. Your event report was saved.",
            );
          }
        }
        await window.cuelira?.consent(false, false);
        const take = structuredClone(e.take);
        setSelected(take);
        setTakes((previous) => [
          take,
          ...previous.filter((t) => t.id !== take.id),
        ]);
        setScreen("review");
      } finally {
        finishing.current = false;
      }
    });
  const stopCamera = () =>
    run(async () => {
      const blob = await (interruptedRecording.current ??
        recorder.current.stop());
      interruptedRecording.current = null;
      setRecording(false);
      if (engine.current && screen === "stage") {
        engine.current.fail(
          Date.now(),
          "Camera stopped by actor. Resume requires capture recovery or continue manually.",
        );
        await window.cuelira?.save(engine.current.take);
        if (blob && window.cuelira) {
          await window.cuelira.videoSave(
            engine.current.take.id,
            await blob.arrayBuffer(),
          );
          engine.current.take.recordingSaved = true;
        }
      }
      await capture.current!.stop();
      await window.cuelira?.consent(false, false);
      setObservation(null);
    });
  const restart = () =>
    run(async () => {
      if (engine.current && screen === "stage") {
        engine.current.stop(Date.now());
        const blob = await (interruptedRecording.current ??
          recorder.current.stop());
        interruptedRecording.current = null;
        setRecording(false);
        await window.cuelira?.save(engine.current.take);
        if (blob && window.cuelira) {
          await window.cuelira.videoSave(
            engine.current.take.id,
            await blob.arrayBuffer(),
          );
          engine.current.take.recordingSaved = true;
        }
        const take = structuredClone(engine.current.take);
        setTakes((p) => [take, ...p.filter((t) => t.id !== take.id)]);
      }
      await capture.current!.stop();
      await window.cuelira?.consent(false, false);
      engine.current = null;
      setCameraConsent(false);
      setRecordConsent(false);
      setObservation(null);
      setScreen("consent");
    });
  const exportTake = (format: "json" | "txt" | "webm") =>
    run(async () => {
      if (!selected) return;
      if (window.cuelira) {
        if (await window.cuelira.export(selected.id, format))
          setNotice("Export saved to your chosen location.");
      } else if (format !== "webm") {
        download(selected, format);
        setNotice("Report downloaded.");
      }
    });
  const deleteTake = () =>
    run(async () => {
      if (!selected) return;
      await window.cuelira?.delete(selected.id);
      setTakes((p) => p.filter((t) => t.id !== selected.id));
      setSelected(null);
      setConfirmDelete(false);
      setScreen("takes");
      setNotice(
        "Take and its app-stored video deleted. Exported copies remain in their chosen locations.",
      );
    });
  const e = engine.current;
  const active = screen === "stage" || screen === "prepare" || !!stream;
  const ready =
    !!stream &&
    sdkStatus === "Running" &&
    !!observation &&
    observation.face === "available" &&
    observation.validationCode === 0 &&
    !observation.reason &&
    Date.now() - observation.capturedAt <= 1200;
  const beat = scene[e?.beat ?? 0];
  const lastTransition = e?.take.events
    .filter((event) => event.type === "accepted" || event.type === "manual")
    .at(-1);
  // Announce authored dialogue once per transition, not rapidly changing metrics.
  const sceneAnnouncement =
    e?.phase === "completed"
      ? `Scene complete. Rowan: ${scene[2].response} Alex's closing line: ${closing}`
      : e?.phase === "paused"
        ? `Scene paused. Camera ${stream ? "remains on" : "is off"}.`
        : e?.phase === "error"
          ? "Camera or SDK interrupted. Retry capture or continue manually."
          : `${lastTransition ? `${lastTransition.type === "manual" ? "Manual continuation" : "Accepted SmartSpectra cue"}. Rowan: ${scene[lastTransition.beat].response} ` : "Scene begins. "}Beat ${(e?.beat ?? 0) + 1}: ${beat.title}. Rowan: ${beat.partner} Performance cue: ${beat.cue}.`;
  const transitions =
    selected?.events.filter(
      (v) => v.type === "accepted" || v.type === "manual",
    ) ?? [];
  const previousTake = takes.find((t) => t.id === compare);
  const freshness = observation && Date.now() - observation.capturedAt <= 1200;
  return (
    <div className="app">
      <header className="app-header">
        <a
          href="#"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            if (!active) setScreen("welcome");
          }}
          aria-label="Cuelira home"
        >
          <Mark />
          <span>Cuelira</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={
              ["welcome", "consent", "prepare", "stage"].includes(screen)
                ? "nav-active"
                : ""
            }
            disabled={active}
            onClick={() => setScreen("welcome")}
          >
            Rehearsal studio
          </button>
          <button
            className={["takes", "review"].includes(screen) ? "nav-active" : ""}
            disabled={active}
            onClick={() => setScreen("takes")}
          >
            My takes <span className="count">{takes.length}</span>
          </button>
        </nav>
        <span className="header-note">A little room for a better take.</span>
      </header>
      {!info?.desktop && (
        <div className="preview-banner">
          Interface preview: camera and SmartSpectra require the Electron app.
          Manual practice is available; no simulated SDK readings.
        </div>
      )}
      <main>
        {error && (
          <div role="alert" className="banner error">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <Icon name="close" />
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="banner notice">
            {notice}
          </p>
        )}
        {screen === "welcome" && (
          <section className="welcome">
            <div className="welcome-copy">
              <h1 tabIndex={-1}>
                Your scene
                <br />
                responds to you.
              </h1>
              <p className="intro">
                A scene partner that meets your performance.
                <br />
                Even when you’re rehearsing alone.
              </p>
              <p className="product-description">{description}</p>
              <div className="actions">
                <button
                  className="primary"
                  onClick={() => setScreen("consent")}
                >
                  Start a rehearsal <Icon name="arrow" />
                </button>
                <button
                  className="text-button"
                  onClick={() => setScreen("help")}
                >
                  How it works
                </button>
              </div>
              <p className="welcome-foot">
                One original scene. Three deliberate cues.
                <br />
                Your choices, kept in the take.
              </p>
            </div>
            <div className="scene-cover">
              <div className="cover-top">
                <span>Tonight’s rehearsal</span>
                <Icon name="book" />
              </div>
              <h2>
                The Last
                <br />
                Message
              </h2>
              <p className="scene-logline">
                A hidden message.
                <br />A friendship at its breaking point.
              </p>
              <div className="cover-dialogue">
                <span>Rowan, your scene partner</span>
                <p>
                  “I thought I could buy us
                  <br />
                  one more day.”
                </p>
              </div>
              <div className="cover-bottom">
                <span>Drama / 45 to 75 seconds</span>
                <span>3 beats</span>
              </div>
            </div>
          </section>
        )}
        {screen === "consent" && (
          <section className="setup">
            <div className="page-heading">
              <h1 tabIndex={-1}>Before the first take.</h1>
              <p>You decide when the camera rolls.</p>
            </div>
            <div className="setup-grid">
              <div className="consent-copy">
                <h2>A camera with a purpose.</h2>
                <p>
                  SmartSpectra observes facial-expression categories and
                  confidence on your device. Accepted performance cues advance
                  the scripted scene. They don’t reveal what you feel or measure
                  your acting ability.
                </p>
                <p>
                  Presage receives authentication and usage data. Its policy
                  also describes automatic AI Insights processed by Presage and
                  Anthropic, independently of telemetry. Optional telemetry is
                  disabled here; this face-only app requests no pulse or
                  breathing data and sends no prompts. Native network traffic
                  has not been independently audited.
                </p>
                <label className="consent-row">
                  <input
                    type="checkbox"
                    checked={cameraConsent}
                    onChange={(v) => setCameraConsent(v.target.checked)}
                  />
                  <span>
                    I am 18 or older and consent to camera access, facial-cue
                    measurement and the Presage processing disclosed here.
                  </span>
                </label>
                <label className="consent-row">
                  <input
                    type="checkbox"
                    checked={recordConsent}
                    onChange={(v) => setRecordConsent(v.target.checked)}
                  />
                  <span>
                    Also record a silent video of my take.{" "}
                    <small>
                      Optional, off by default. No microphone access.
                    </small>
                  </span>
                </label>
                <p className="small">
                  Reports and optional video stay in app storage until you
                  delete them. Exports are separate copies. Stop camera is
                  always available.
                </p>
                <button
                  className="text-button policy-link"
                  onClick={() => {
                    if (window.cuelira)
                      void window.cuelira
                        .openPresagePolicy()
                        .catch(() =>
                          setError(
                            "Could not open the policy. Visit presagetech.com/legal/privacy-policy in your browser.",
                          ),
                        );
                    else
                      window.open(
                        "https://presagetech.com/legal/privacy-policy",
                        "_blank",
                        "noopener",
                      );
                  }}
                >
                  Read Presage’s privacy policy
                </button>
                <details>
                  <summary>Local configuration & storage</summary>
                  <p className="small">{info?.storage}</p>
                  <p className="small">
                    Credential:{" "}
                    {info?.keyConfigured
                      ? "configured (value hidden)"
                      : "missing: add your key to .env and restart"}
                    . Native SDK:{" "}
                    {info?.sdkAvailable ? "loaded" : "unavailable"}. Platform:{" "}
                    {info?.platform}.
                  </p>
                </details>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={!cameraConsent || busy}
                    onClick={startCamera}
                  >
                    <Icon name="camera" />
                    {busy ? "Starting camera…" : "Enable camera"}
                  </button>
                  {busy && (
                    <button
                      onClick={() => {
                        setNotice("Camera startup cancellation requested.");
                        void capture
                          .current!.stop()
                          .then(() => window.cuelira?.consent(false, false))
                          .catch(() =>
                            setError(
                              "Startup cancellation failed. Close the application to release capture.",
                            ),
                          );
                      }}
                    >
                      Cancel camera startup
                    </button>
                  )}
                  <button disabled={busy} onClick={manualPrep}>
                    Rehearse manually, camera off
                  </button>
                </div>
              </div>
              <Preview stream={stream} recording={false} compact />
            </div>
          </section>
        )}
        {screen === "prepare" && (
          <section className="setup">
            <div className="page-heading">
              <h1 tabIndex={-1}>The Last Message</h1>
              <p>You are Alex. Your scene partner is Rowan.</p>
            </div>
            <div className="setup-grid">
              <div className="prep-copy">
                <h2>Get your choice back.</h2>
                <p>
                  Rowan hid a message that could change your future. You’ve
                  found it. Your objective is to get the phone back, without
                  giving Rowan the comfort of forgiveness.
                </p>
                <ol className="beat-list">
                  {scene.map((b, i) => (
                    <li key={b.cue}>
                      <span className="beat-number">{i + 1}</span>
                      <div>
                        <h3>{b.title}</h3>
                        <p>
                          {b.cue === "neutral"
                            ? "Return toward neutral after a deliberate non-neutral expression."
                            : `Perform a deliberate ${b.cue} expression.`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <details className="full-script">
                  <summary>Read the complete scene script</summary>
                  {scene.map((b, i) => (
                    <div key={b.cue}>
                      <h3>
                        {i + 1}. {b.title}
                      </h3>
                      <p>
                        <strong>Rowan:</strong> {b.partner}
                      </p>
                      <p>
                        <strong>Alex:</strong> {b.actor}
                      </p>
                      <p>
                        <strong>Rowan, after the {b.cue} cue:</strong>{" "}
                        {b.response}
                      </p>
                    </div>
                  ))}
                  <p>
                    <strong>Alex:</strong> {closing}
                  </p>
                </details>
                <p className="small">
                  Read both parts before you begin. Speak Alex’s lines in your
                  own time. After each cue is accepted, Rowan answers. Captions
                  stay visible. Allow 45 to 75 seconds; take longer if you need
                  it.
                </p>
                <div className="mode-label">
                  {mode === "live"
                    ? `SmartSpectra: ${ready ? "fresh face metrics received" : "waiting for fresh, valid face metrics"}`
                    : "Manual rehearsal (no live recognition)"}
                </div>
                {mode === "live" && (
                  <p className="small">
                    Observed:{" "}
                    {freshness
                      ? (observation?.expression ?? "unavailable")
                      : "waiting"}{" "}
                    / {sdkStatus}. {observation?.reason}
                  </p>
                )}
                <div className="actions">
                  <button
                    className="primary"
                    disabled={busy || (mode === "live" && !ready)}
                    onClick={begin}
                  >
                    <Icon name="play" />
                    Begin the scene
                  </button>
                  {mode === "live" && (
                    <button disabled={busy} onClick={stopCamera}>
                      Stop camera
                    </button>
                  )}
                  <button disabled={busy} onClick={restart}>
                    Change setup
                  </button>
                </div>
                {mode === "live" && !stream && (
                  <button disabled={busy} onClick={startCamera}>
                    Retry camera
                  </button>
                )}
              </div>
              <div>
                <Preview stream={stream} recording={false} compact />
                <div className="setup-note">
                  <span>Scene notes</span>
                  <p>
                    Stay with the scene. Expression labels are cue instructions
                    for this exercise, never a universal reading of a face.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
        {screen === "stage" && e && (
          <section className="stage">
            <p
              className="scene-announcement"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {sceneAnnouncement}
            </p>
            <div className="stage-heading">
              <div>
                <h1 tabIndex={-1}>The Last Message</h1>
                <span>
                  {mode === "live"
                    ? "Live rehearsal"
                    : "Manual rehearsal (no SDK recognition)"}
                </span>
              </div>
              <div className="take-clock">
                {elapsed((e.take.endedAt ?? Date.now()) - e.take.startedAt)}
              </div>
            </div>
            <div className="stage-grid">
              <div className="monitor">
                <Preview stream={stream} recording={recording} />
                <div className="signal-strip">
                  <div>
                    <span>SmartSpectra</span>
                    <strong>{sdkStatus}</strong>
                  </div>
                  <div>
                    <span>Observed expression</span>
                    <strong>
                      {mode === "manual"
                        ? "Not measuring"
                        : freshness
                          ? (observation?.expression ?? "Unavailable")
                          : "No fresh reading"}
                    </strong>
                  </div>
                  <div>
                    <span>Confidence / stability</span>
                    <strong>
                      {freshness &&
                      observation?.probability !== null &&
                      observation
                        ? `${Math.round(observation.probability * 100)}% / ${observation.stable ? "stable" : "unstable"}`
                        : "Unavailable"}
                    </strong>
                  </div>
                </div>
                <details className="diagnostics">
                  <summary>Observation details</summary>
                  <p>
                    {observation?.validation ?? "No SDK validation received"}.
                    Source: {observation?.source ?? "none"}. SDK timestamp (µs):{" "}
                    {observation?.sdkTimestampUs || "none"}. Threshold: 65% over
                    700 ms, provisional.
                  </p>
                </details>
              </div>
              <div className="script">
                <div className="script-header">
                  <span>Beat {e.beat + 1} of 3</span>
                  <span>{beat.title}</span>
                </div>
                <div className="dialogue" key={e.beat}>
                  {e.beat > 0 && (
                    <div className="previous-response">
                      <span>Rowan’s response</span>
                      <p>“{scene[e.beat - 1].response}”</p>
                      <small>
                        {e.take.events
                          .filter(
                            (v) => v.type === "accepted" || v.type === "manual",
                          )
                          .at(-1)?.type === "accepted"
                          ? "Triggered by accepted SDK observation"
                          : "Continued manually"}
                      </small>
                    </div>
                  )}
                  {e.phase !== "completed" ? (
                    <>
                      <span className="speaker">Rowan</span>
                      <p className="partner-line">“{beat.partner}”</p>
                      <span className="speaker actor-label">
                        Alex: your line
                      </span>
                      <p className="actor-line">{beat.actor}</p>
                    </>
                  ) : (
                    <>
                      <span className="speaker">Rowan</span>
                      <p className="partner-line">“{scene[2].response}”</p>
                      <span className="speaker actor-label">
                        Alex: closing line
                      </span>
                      <p className="actor-line">{closing}</p>
                    </>
                  )}
                </div>
                <div className="cue-box">
                  <span>
                    {e.phase === "completed"
                      ? "Scene complete"
                      : `Your performance cue: ${beat.cue === "neutral" ? "return toward neutral" : beat.cue}`}
                  </span>
                  <p>
                    {e.phase === "completed"
                      ? "Read your closing line, then finish the take."
                      : e.phase === "paused"
                        ? stream
                          ? "Paused. Camera remains on. Resume when you are ready."
                          : "Paused. Camera is off. Resume when you are ready."
                        : e.phase === "error"
                          ? "Capture stopped. Retry camera or continue manually."
                          : mode === "manual"
                            ? "Take your time. Continue manually when you finish the line."
                            : e.hint}
                  </p>
                  {e.phase === "rehearsing" && <small>{beat.direction}</small>}
                </div>
              </div>
            </div>
            <div className="stage-controls">
              <div className="actions">
                {e.phase === "completed" ? (
                  <button className="primary" disabled={busy} onClick={finish}>
                    <Icon name="check" />
                    Finish & review take
                  </button>
                ) : (
                  <>
                    <button
                      disabled={busy || e.phase === "error"}
                      onClick={() => {
                        e.phase === "paused"
                          ? e.resume(Date.now())
                          : e.pause(Date.now());
                        redraw((n) => n + 1);
                      }}
                    >
                      <Icon name={e.phase === "paused" ? "play" : "pause"} />
                      {e.phase === "paused" ? "Resume scene" : "Pause scene"}
                    </button>
                    {e.phase === "error" && mode === "live" && (
                      <button disabled={busy} onClick={startCamera}>
                        Retry camera
                      </button>
                    )}
                    <button disabled={busy} onClick={finish}>
                      End & save take
                    </button>
                  </>
                )}
                <button disabled={busy} onClick={restart}>
                  <Icon name="retry" />
                  Restart
                </button>
                {stream && (
                  <button disabled={busy} onClick={stopCamera}>
                    <Icon name="stop" />
                    Stop camera
                  </button>
                )}
              </div>
              {e.phase !== "completed" && (
                <button
                  disabled={busy || e.phase === "paused"}
                  className="manual-button"
                  onClick={() => {
                    if (e.phase === "error") {
                      e.recover(Date.now());
                      e.resume(Date.now());
                    }
                    e.manual(Date.now());
                    redraw((n) => n + 1);
                  }}
                >
                  Continue manually <Icon name="arrow" />
                </button>
              )}
            </div>
            <div
              className="beat-progress"
              aria-label={`Scene progress: beat ${e.beat + 1} of 3`}
            >
              {scene.map((b, i) => (
                <span
                  key={b.cue}
                  className={
                    e.phase === "completed" || i < e.beat
                      ? "done"
                      : i === e.beat
                        ? "current"
                        : ""
                  }
                >
                  {i + 1}. {b.title}
                </span>
              ))}
            </div>
          </section>
        )}
        {screen === "review" && selected && (
          <section className="review">
            <div className="page-heading review-heading">
              <div>
                <h1 tabIndex={-1}>
                  {selected.status === "completed"
                    ? "A take to look back on."
                    : "A take, saved so far."}
                </h1>
                <p>
                  The Last Message /{" "}
                  {new Date(selected.startedAt).toLocaleString()} /{" "}
                  {elapsed(
                    (selected.endedAt ?? selected.startedAt) -
                      selected.startedAt,
                  )}
                </p>
              </div>
              <button className="primary" onClick={restart}>
                Rehearse again <Icon name="retry" />
              </button>
            </div>
            <div className="review-summary">
              <div>
                <span>Take status</span>
                <strong>{selected.status}</strong>
              </div>
              <div>
                <span>Accepted SDK cues</span>
                <strong>
                  {transitions.filter((v) => v.type === "accepted").length} of 3
                </strong>
              </div>
              <div>
                <span>Manual transitions</span>
                <strong>
                  {transitions.filter((v) => v.type === "manual").length}
                </strong>
              </div>
              <div>
                <span>Capture mode</span>
                <strong>{selected.mode}</strong>
              </div>
            </div>
            {videoUrl && (
              <video
                controls
                className="playback"
                src={videoUrl}
                aria-label="Recorded take (silent video)"
              />
            )}
            <h2>The moments that moved the scene.</h2>
            <p className="small">
              Observable cues and scene choices. No acting score, emotional
              diagnosis or inferred intent.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Beat</th>
                    <th>Time</th>
                    <th>Transition</th>
                    <th>Observed cue</th>
                    <th>Confidence</th>
                    <th>Stability</th>
                  </tr>
                </thead>
                <tbody>
                  {scene.map((b, i) => {
                    const event = transitions.find((v) => v.beat === i);
                    return (
                      <tr key={b.cue}>
                        <td>
                          {i + 1}. {b.title}
                        </td>
                        <td>
                          {event
                            ? `${((event.at - selected.startedAt) / 1000).toFixed(1)}s`
                            : "N/A"}
                        </td>
                        <td>
                          <span
                            className={`transition-label ${event?.type === "accepted" ? "accepted" : ""}`}
                          >
                            {event?.type === "accepted"
                              ? "Accepted SDK observation"
                              : event?.type === "manual"
                                ? "Manual continuation"
                                : "Not reached"}
                          </span>
                        </td>
                        <td>
                          {event?.observation?.expression ?? "Not measured"}
                        </td>
                        <td>
                          {event?.observation?.probability != null
                            ? `${(event.observation.probability * 100).toFixed(1)}%`
                            : "N/A"}
                        </td>
                        <td>
                          {event?.observation
                            ? event.observation.stable
                              ? "Stable"
                              : "Unstable"
                            : "N/A"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <details className="event-log">
              <summary>
                Full event report ({selected.events.length} events, sampled
                observations up to 4 / second)
              </summary>
              <ol>
                {selected.events.map((v, i) => (
                  <li key={i}>
                    <time>
                      {((v.at - selected.startedAt) / 1000).toFixed(2)}s
                    </time>
                    <strong>{v.type}</strong>
                    <span>
                      {v.detail}
                      {v.observation
                        ? ` / ${v.observation.expression ?? "unavailable"} / ${v.observation.validation}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
            {takes.length > 1 && (
              <div className="comparison">
                <label htmlFor="compare">
                  Compare observable transitions with another take
                </label>
                <select
                  id="compare"
                  value={compare}
                  onChange={(v) => setCompare(v.target.value)}
                >
                  <option value="">Choose a take</option>
                  {takes
                    .filter((t) => t.id !== selected.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {new Date(t.startedAt).toLocaleString()} / {t.mode}
                      </option>
                    ))}
                </select>
                {previousTake && (
                  <p>
                    Earlier take:{" "}
                    {
                      previousTake.events.filter((v) => v.type === "accepted")
                        .length
                    }{" "}
                    accepted SDK cues,{" "}
                    {
                      previousTake.events.filter((v) => v.type === "manual")
                        .length
                    }{" "}
                    manual transitions. Current take:{" "}
                    {transitions.filter((v) => v.type === "accepted").length}{" "}
                    accepted,{" "}
                    {transitions.filter((v) => v.type === "manual").length}{" "}
                    manual. These counts describe the interaction, not
                    performance quality.
                  </p>
                )}
              </div>
            )}
            <div className="export-bar">
              <div>
                <h2>Keep the take. Keep the context.</h2>
                <p className="small">
                  {selected.recordingSaved
                    ? "Silent video saved locally."
                    : "No video saved."}{" "}
                  Reports remain until you delete them.
                </p>
              </div>
              <div className="actions">
                <button disabled={busy} onClick={() => exportTake("txt")}>
                  <Icon name="download" />
                  Text report
                </button>
                <button disabled={busy} onClick={() => exportTake("json")}>
                  JSON events
                </button>
                {selected.recordingSaved && (
                  <button disabled={busy} onClick={() => exportTake("webm")}>
                    Export video
                  </button>
                )}
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icon name="trash" />
                  Delete take
                </button>
              </div>
            </div>
            {confirmDelete && (
              <div className="banner deletion" role="alert">
                <p>
                  Delete this take and its app-stored video? Exported copies
                  will remain.
                </p>
                <button className="danger" disabled={busy} onClick={deleteTake}>
                  Delete permanently
                </button>
                <button onClick={() => setConfirmDelete(false)}>
                  Keep take
                </button>
              </div>
            )}
          </section>
        )}
        {screen === "takes" && (
          <section className="takes">
            <div className="page-heading">
              <h1 tabIndex={-1}>Every take is a choice.</h1>
              <p>Your rehearsal reports, saved on this device.</p>
            </div>
            {takes.length ? (
              <div className="take-list">
                {takes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelected(t);
                      setScreen("review");
                    }}
                  >
                    <div>
                      <strong>The Last Message</strong>
                      <span>
                        {new Date(t.startedAt).toLocaleString()} / {t.mode} /{" "}
                        {t.status}
                      </span>
                    </div>
                    <span>
                      {t.events.filter((v) => v.type === "accepted").length} SDK
                      cues /{" "}
                      {t.events.filter((v) => v.type === "manual").length}{" "}
                      manual
                    </span>
                    <Icon name="arrow" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Icon name="book" size={32} />
                <h2>Your first take starts here.</h2>
                <p>Finish or end a rehearsal to save its event report.</p>
                <button
                  className="primary"
                  onClick={() => setScreen("consent")}
                >
                  Start a rehearsal
                </button>
              </div>
            )}
            <p className="storage-path">Storage: {info?.storage}</p>
          </section>
        )}
        {(screen === "help" || screen === "privacy") && (
          <section className="reading">
            <h1 tabIndex={-1}>
              {screen === "help"
                ? "A responsive scene, in three beats."
                : "Your camera. Your take. Your choice."}
            </h1>
            {screen === "help" ? (
              <>
                <p>
                  In The Last Message, you play Alex opposite a scripted
                  partner, Rowan. Speak your line, perform the requested facial
                  cue and briefly hold it. SmartSpectra observes the cue;
                  Cuelira validates it before Rowan answers.
                </p>
                <h2>Deliberate cues, honest transitions.</h2>
                <p>
                  Surprise opens the discovery. A confrontational expression
                  changes the conversation. A controlled return toward neutral
                  closes the scene. Cuelira never decides what you feel or
                  grades your acting.
                </p>
                <h2>Keep moving when sensing cannot.</h2>
                <p>
                  Use Continue manually if a cue is not recognized. The review
                  identifies that transition as manual. Pause keeps the camera
                  on; Stop camera releases it. Resume re-arms the cue. A restart
                  saves the interrupted take.
                </p>
                <h2>Review what actually happened.</h2>
                <p>
                  The report records accepted observations, manual
                  continuations, timestamps and interruptions. Optional silent
                  video uses separate consent; it records the camera image only.
                  Captions provide both sides of the script. There is no voice
                  generation or microphone capture.
                </p>
              </>
            ) : (
              <>
                <p>
                  Camera access starts only after explicit consent and Enable
                  camera. SmartSpectra processes facial metrics on the device.
                  Its required authentication and subscription checks
                  communicate with Presage; Cuelira does not claim to work
                  offline.
                </p>
                <p>
                  Optional SmartSpectra telemetry is disabled. This does not
                  disable authentication, usage records, model delivery or the
                  automatic Insights described in Presage’s policy, which
                  involves Presage and Anthropic. This app requests only face
                  metrics and sends no Insights prompts. The Node guide
                  describes automatic Insights for vitals; those vitals are not
                  requested here. Exact native network traffic has not been
                  independently audited. Cuelira adds no analytics, upload
                  server or AI service. Presage controls its service retention
                  and deletion; deleting a local take does not delete provider
                  records. The SDK keeps separate local authentication/device
                  cache files.
                </p>
                <h2>What stays, and where.</h2>
                <p>
                  Each take retains scene events, sampled expression summaries
                  and optional silent WebM video in local application data.
                  Video recording is off by default. No microphone is requested.
                  Retention has no automatic expiry; delete individual takes
                  from the review. Closing the app stops capture.
                </p>
                <p>
                  Delete take removes the app’s JSON and video files. Exports
                  and backups are independent copies you control; deletion is
                  not forensic erasure. Your own screenshots and screen
                  recordings can reveal your face and room.
                </p>
                <p className="storage-path">
                  Local take storage: {info?.storage}
                </p>
              </>
            )}
            <div className="actions">
              <button className="primary" onClick={() => setScreen("consent")}>
                Start a rehearsal
              </button>
              <button onClick={() => setScreen("welcome")}>
                Back to studio
              </button>
            </div>
          </section>
        )}
      </main>
      <footer>
        <span>
          Cuelira{" "}
          <span className="footer-tagline">/ Your scene responds to you.</span>
        </span>
        <span>Built with Presage SmartSpectra</span>
        <button disabled={active} onClick={() => setScreen("privacy")}>
          Privacy & consent
        </button>
      </footer>
    </div>
  );
}
