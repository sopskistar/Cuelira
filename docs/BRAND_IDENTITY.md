# Cuelira visual identity

**Cuelira** is final. **Your scene responds to you.** I preserve the name, repository and product description. This work does not propose replacement names or claim trademark clearance.

## Two original directions

I created both directions before exporting the selected system:

1. **Cue frame**, selected: an open C-shaped camera frame receives a right-facing cue. It joins framing, the initial C and responsive playback without a face, mask or generic AI motif. [Direction A](../assets/brand/direction-a-cue-frame.svg).
2. **Open dialogue**, alternate: two offset brackets leave an exchange open. It suggests two speakers but reads less distinctly at small sizes. [Direction B](../assets/brand/direction-b-dialogue.svg).

The icon uses a 64-unit grid, a consistent nine-unit frame and deliberate negative space. I exported 16, 24, 32, 48, 64, 128 and 256-pixel PNGs plus SVG, 512-pixel desktop art and a multi-resolution Windows ICO. The wordmark uses licensed Barlow Condensed, converted to paths, so the SVG does not depend on an installed font. Light and dark wordmarks are separate transparent assets. Minimum clear space is the frame's stroke width on every side; do not stretch, add glow or place on a low-contrast image.

## Palette and typography

| Token / role                                | Value     |
| ------------------------------------------- | --------- |
| Studio charcoal, application ground         | `#151919` |
| Monitor surface                             | `#1e2423` |
| Sage, scene cover                           | `#98a990` |
| Cue mint, primary action and accepted state | `#c7ddac` |
| Script sheet                                | `#e9ece3` |
| Script ink                                  | `#242c27` |
| Body foreground                             | `#f3f5ed` |
| Secondary text                              | `#b1bcb6` |
| Error / deletion text                       | `#efab93` |

Barlow Condensed 500/600 carries film-title scale; Public Sans 400/500/600 carries controls and scripts. Fonts are self-hosted through Fontsource, not fetched from a third-party font CDN at runtime. Their OFL files are in the installed packages; my [notices](THIRD_PARTY_NOTICES.md) identify their licenses. Controls use a 44-pixel minimum height, spacing follows a four-pixel rhythm, and body data is not disguised as a theatrical dashboard.

## Visual references and original application

I reviewed the shared `~/hackathon-creative-studio/references/framer-marketplace.md` on this machine and public [Framer Marketplace](https://www.framer.com/marketplace/templates/) categories: portfolio typography and generous composition are useful, but a marketing template does not determine an actor's working screen. [21st](https://21st.dev/) demonstrates dense component browsing; I kept Cuelira's navigation shallower. [shadcn sidebar guidance](https://ui.shadcn.com/docs/components/base/sidebar) reinforced that a sidebar is unnecessary for two destinations. [Recent](https://recent.design/) separates app screenshots and icon/launch assets, which informed consistent exports across surfaces. I reviewed [coldRead](https://www.coldreadapp.com/) for actual actor workflow conventions. Public pages were read; not every image-heavy gallery was visually inspectable, and inaccessible references were not claimed as studied.

My three layout directions were monitor-and-script, teleprompter-first, and contact-sheet review-first. I selected monitor-and-script: the actor sees framing and the authored response together. A pale script sheet carries both dialogue and the cue's cause. The compact desktop layout keeps controls visible while the script area can scroll. I did not copy templates, components or commercial artwork. No generated stock image or invented actor footage appears.

## Asset inventory and provenance

`assets/brand/` contains original vector directions, light/dark icon and outlined wordmark SVG/PNG, desktop PNG/ICO, social preview, GitHub preview, and 1920×1080 video intro/outro SVG/PNG. `public/brand/icon.svg` is the renderer favicon. `scripts/brand.mjs` is the reproducible original vector/raster export source. PNGs derive from those vectors through Sharp; no image model or purchased asset is used. UI icons are original consistent-stroke SVGs in `src/ui/Icon.tsx`.

The name was fixed before visual work. I have not performed a trademark clearance search and have not established a material naming conflict. That is a limit of this focused build, not a decision to rename.
