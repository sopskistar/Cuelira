---
name: Cuelira
description: Your scene responds to you.
colors:
  cue-mint: "#c7ddac"
  cue-mint-hover: "#d9e9c6"
  studio-green: "#1b3125"
  studio-coal: "#151919"
  monitor: "#1e2423"
  hover-surface: "#2c3432"
  divider: "#424c48"
  muted-ink: "#b1bcb6"
  foreground: "#f3f5ed"
  script-sheet: "#e9ece3"
  script-ink: "#242c27"
  script-secondary: "#536055"
  cover-sage: "#98a990"
  caution: "#efab93"
  error-surface: "#482d29"
  recording-ink: "#ffd6c9"
  camera-overlay: "#151919d9"
  focus: "#d8e4bc"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(76px, 7vw, 112px)"
    fontWeight: 500
    lineHeight: 0.98
  headline:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "54px"
    fontWeight: 500
    lineHeight: 1.08
  title:
    fontFamily: "Public Sans, sans-serif"
    fontSize: "23px"
    fontWeight: 500
    lineHeight: 1.08
  body:
    fontFamily: "Public Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Public Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
  actor-line:
    fontFamily: "Public Sans, sans-serif"
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  overlay: "3px"
  small: "4px"
  control: "5px"
spacing:
  tight: "4px"
  small: "8px"
  compact: "12px"
  medium: "16px"
  group: "20px"
  large: "24px"
  section: "32px"
  broad: "40px"
components:
  button-primary:
    backgroundColor: "{colors.cue-mint}"
    textColor: "{colors.studio-green}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.cue-mint-hover}"
    textColor: "{colors.studio-green}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  select:
    backgroundColor: "{colors.monitor}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.small}"
    padding: "8px 12px"
  cue-panel:
    backgroundColor: "{colors.cue-mint}"
    textColor: "{colors.studio-green}"
    padding: "16px 24px"
  script-panel:
    backgroundColor: "{colors.script-sheet}"
    textColor: "{colors.script-ink}"
---

# Design System: Cuelira

## Overview

**Creative North Star: "The rehearsal studio"**

I use the visual language of a working rehearsal room: a quiet monitor surface, a legible script and a restrained cue color. Film influence lives in the condensed titles and the separation of camera, dialogue and controls. Familiar controls keep the visual identity subordinate to the actor's task.

This records the implemented system in `src/styles.css` and `src/ui/App.tsx`. The final Cuelira name and tagline remain fixed. Page-specific composition belongs to the surface brief; future screens inherit the palette, typography and component behavior rather than reproducing one layout everywhere.

**Key Characteristics:**

- Condensed film-title typography paired with plain working text.
- Dark studio surfaces and a pale, high-contrast script.
- Mint as an action, cue and accepted-state color.
- Flat tonal hierarchy, compact controls and deliberate state motion.
- Explicit captions, camera status and manual-action provenance.

## Colors

The palette uses dark green-tinted neutrals, muted sage and a pale mint signal; the frontmatter records the exact source values.

### Primary

- **Cue mint** carries primary actions, the cue panel, selected progress and accepted-observation text. Its hover variant brightens the same role.
- **Studio green** supplies readable ink on mint and sage surfaces and the preview-notice background.

### Neutral

- **Studio coal** is the application ground; **Monitor** and **Hover surface** create quiet surface distinctions.
- **Foreground** carries ordinary text; **Muted ink** carries secondary explanation; **Divider** separates groups.
- **Script sheet**, **Script ink** and **Script secondary** form the dialogue-reading surface.
- **Cover sage** identifies the original rehearsal scene on the welcome screen.
- **Camera overlay** protects camera-status legibility over moving imagery; **Focus** identifies keyboard interaction.

The caution/error colors carry deletion or error states, and recording ink remains reserved for the visible recording state.

**The State Has Words Rule.** Pair signal colors with explicit text. An accepted observation, manual continuation, camera-off state or error must remain understandable without color.

## Typography

**Display Font:** Barlow Condensed, with sans-serif fallback. **Body Font:** Public Sans, with sans-serif fallback. Both are locally bundled through Fontsource; do not introduce a runtime font-CDN dependency.

Condensed display text gives titles their film character; controls, scripts and data use the more open body face. The application has role-specific sizes rather than a single mathematical type ramp.

### Hierarchy

- **Display:** large welcome headline; the responsive range is in frontmatter. The scene-cover title uses a related, heavier condensed treatment.
- **Headline:** page titles, with a smaller rehearsal title during operation.
- **Title:** section headings and secondary task hierarchy.
- **Body:** ordinary prose, with paragraph measure capped at 70 characters.
- **Label:** consent help and secondary explanation; functional stage status is at least 12 pixels.
- **Actor line:** the strongest dialogue text. Partner lines are slightly smaller and lighter; both roles retain explicit speaker captions.

**The Working Text Rule.** Use Public Sans for dialogue, buttons, labels and measurements; condensed type is for identity and titles. Timers and event timestamps use tabular numerals.

## Layout

The application shell is centered and capped at 1800 pixels, with proportional side gutters. The header contains the identity and two navigation destinations; it does not need a sidebar. Content uses `minmax(0, 1fr)` tracks, consistent group spacing and natural text wrapping. The four-pixel spacing rhythm is the shared basis; percentage gutters and component dimensions are functional exceptions.

The supported Electron window minimum is 960×680. At that minimum the compact stage keeps dialogue and controls visible, permits the script reading area to scroll and reduces secondary instruction density. Width adjustments occur at 1100 pixels; an 800-pixel fallback stacks work areas, but it is not a shipped mobile companion. At desktop heights up to 800 pixels the header, spacing and dialogue typography compact together. Wider-than-1600 layouts increase gutters instead of stretching the work indefinitely.

Review data uses a semantic table inside a horizontal-overflow region. Long local paths and diagnostics wrap. Always-visible script captions provide the partner and actor's words; voice playback is not a layout requirement of this build.

## Elevation & Depth

The system is flat and uses tonal surfaces plus rules, not box shadows. The pale script and monitor surface separate jobs without simulated glass, glow or floating panels. Camera-status text gets a translucent coal backing because real image content varies; this is a legibility treatment, not decorative blur.

**The Flat Studio Rule.** Keep ordinary surfaces shadow-free. Use the existing tone and border roles to express grouping and state.

## Shapes

Controls have gently eased corners; small labels and alerts use tighter corners. Script and scene-cover surfaces remain square. Single-pixel borders separate controls and report rows, while a two-pixel rule indicates active navigation or beat progress. The face-framing guide uses a softly rounded outline only while capture is present. The original Cuelira mark uses crisp vector geometry and must not be distorted.

## Components

### Buttons

Primary actions use cue mint with green ink and a medium weight. Secondary controls use transparent fill, foreground text and the divider stroke. Text actions remove the visible stroke. Standard buttons have a 44-pixel minimum height, with compact horizontal padding; hover changes tone and border, and active presses move by one pixel. Disabled controls reduce opacity, suppress motion and use a not-allowed cursor.

Keyboard focus uses an immediate three-pixel outline with a four-pixel offset. Do not defer focus indication behind an animation.

### Inputs / Fields

Consent uses native, explicitly labeled checkboxes with mint accent. The optional-recording checkbox includes separate explanatory text. Select fields use the monitor surface, foreground ink and a thin divider stroke. Keep functional labels outside placeholder text.

### Navigation

Two plain text destinations share the header with the wordmark. The selected destination has brighter ink and a mint underline. During capture or preparation, navigation disables actions that would bypass session handling. The small take count is secondary information, not a headline statistic.

### Script and cue panels

The script sheet uses its own dark ink and secondary-text roles. Distinct speaker labels precede dialogue; the actor's line has greater weight. The cue panel is attached to the script surface and uses mint/green contrast, a short state explanation and a deliberate cue direction. The compact-height mode hides the longer direction while preserving the cue and immediate state message; the complete script remains available before the take.

Dialogue changes use a short opacity/vertical-offset transition. Reduced-motion preference disables animations and transitions globally. The page remains legible when motion is removed.

### Camera, reports and notices

The preview mirrors the displayed image, identifies camera and recording state, and supplies an explicit camera-off empty state. It never fills an absent camera with a pretend face or biometric display. Reports use aligned rows and readable event provenance; warning/deletion notices use both caution color and descriptive text. Expandable details keep diagnostics available without dominating the rehearsal.

## Do's and Don'ts

### Do:

- **Do** use the existing color and font roles through the root CSS tokens.
- **Do** keep the primary rehearsal controls reachable at the supported minimum window size.
- **Do** preserve speaker captions and honest manual-versus-SDK labels.
- **Do** provide immediate keyboard focus and honor reduced motion.
- **Do** show a genuine unavailable or camera-off state when evidence is absent.

### Don't:

- **Don't** replace the fixed Cuelira name, tagline or original mark.
- **Don't** introduce generic AI illustrations, random gradients or unnecessary neon.
- **Don't** use decorative animation that competes with dialogue or live observation.
- **Don't** turn expression categories into psychological or acting-quality judgments.
- **Don't** treat inherited small footer/data text or reduced footer hit areas as a new accessibility standard.
