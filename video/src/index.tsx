import React from "react";
import {
  registerRoot,
  Composition,
  AbsoluteFill,
  Sequence,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import manifest from "../manifest.json";
const bg = "#151919";
const ink = "#f3f5ed";
const accent = "#c7ddac";
const face = "Cuelira Display, sans-serif";
const Font = () => (
  <style>{`@font-face {font-family:'Cuelira Display'; src:url('${staticFile("generated/barlow.woff")}') format('woff'); font-weight:600;}`}</style>
);
function Title({ outro = false }: { outro?: boolean }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        opacity: interpolate(frame, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}
    >
      <Img
        src={staticFile(
          outro ? "generated/video-outro.svg" : "generated/video-intro.svg",
        )}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
}
function Slate({ title, body }: { title: string; body: string }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        padding: "170px 155px",
        justifyContent: "center",
        color: ink,
      }}
    >
      <Font />
      <h1
        style={{
          fontFamily: face,
          fontSize: 112,
          lineHeight: 1.05,
          fontWeight: 600,
          margin: 0,
          maxWidth: 1450,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontFamily: face,
          fontSize: 50,
          lineHeight: 1.35,
          color: accent,
          maxWidth: 1450,
        }}
      >
        {body}
      </p>
    </AbsoluteFill>
  );
}
function Footage() {
  return manifest.liveVerified ? (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <OffthreadVideo
        src={staticFile(`footage/${manifest.footage}`)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </AbsoluteFill>
  ) : (
    <Slate
      title="Authentic performance footage needed."
      body="Editing placeholder. No webcam performance or SmartSpectra readings are simulated here."
    />
  );
}
function Caption({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 42,
        left: 120,
        right: 120,
        padding: "14px 24px",
        backgroundColor: bg,
        color: ink,
        fontFamily: face,
        fontSize: 40,
        lineHeight: 1.2,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}
function Demo() {
  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <Font />
      <Sequence name="Cuelira intro" from={0} durationInFrames={150}>
        <Title />
      </Sequence>
      <Sequence name="Solo rehearsal problem" from={150} durationInFrames={150}>
        <Slate
          title="A recorded line can’t meet your performance."
          body="I built one responsive scene for an actor rehearsing alone."
        />
      </Sequence>
      <Sequence
        name="Genuine uncut Windows capture"
        from={300}
        durationInFrames={2100}
      >
        <Footage />
        <Sequence
          name="Consent caption"
          from={0}
          durationInFrames={210}
          layout="none"
        >
          <Caption text="I choose camera measurement. Video recording has separate consent." />
        </Sequence>
        <Sequence
          name="Sponsor integration caption"
          from={210}
          durationInFrames={420}
          layout="none"
        >
          <Caption text="SmartSpectra face metrics validate the performed cue before Rowan answers." />
        </Sequence>
        <Sequence
          name="Neutral safety caption"
          from={1260}
          durationInFrames={300}
          layout="none"
        >
          <Caption text="The final cue requires a deliberate return toward neutral, after a non-neutral expression." />
        </Sequence>
        <Sequence
          name="Review caption"
          from={1800}
          durationInFrames={300}
          layout="none"
        >
          <Caption text="The review keeps accepted SDK observations and manual continuations distinct." />
        </Sequence>
      </Sequence>
      <Sequence
        name="Inspectable technical proof"
        from={2400}
        durationInFrames={150}
      >
        <Slate
          title="Follow the observation to the response."
          body="src/sdk/live.ts → src/core/normalize.ts → src/core/engine.ts. Tests and acceptance evidence are linked in the README."
        />
      </Sequence>
      <Sequence name="Cuelira outro" from={2550} durationInFrames={150}>
        <Title outro />
      </Sequence>
      {!manifest.liveVerified && (
        <div
          style={{
            position: "absolute",
            top: 34,
            left: 80,
            color: accent,
            fontFamily: face,
            fontSize: 30,
          }}
        >
          Editing preview / final video incomplete / awaiting genuine camera
          proof
        </div>
      )}
    </AbsoluteFill>
  );
}
function BrandProof() {
  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <Sequence name="Intro artwork" from={0} durationInFrames={90}>
        <Title />
      </Sequence>
      <Sequence name="Outro artwork" from={90} durationInFrames={90}>
        <Title outro />
      </Sequence>
      <div
        style={{
          position: "absolute",
          bottom: 42,
          left: 80,
          color: accent,
          fontFamily: "sans-serif",
          fontSize: 26,
        }}
      >
        Brand motion proof only. No live SDK demonstration.
      </div>
    </AbsoluteFill>
  );
}
const Root = () => (
  <>
    <Composition
      id="CueliraDemo"
      component={Demo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={2700}
    />
    <Composition
      id="BrandProof"
      component={BrandProof}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={180}
    />
  </>
);
registerRoot(Root);
