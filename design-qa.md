# Design QA

## Comparison Target

- Source issue evidence and visual truth: `/var/folders/w3/3fxksxls04lbdbl8f0zfw50m0000gn/T/codex-clipboard-a4b8325e-0a10-40ec-8870-d045c37e113a.png`
- Requested transformation: remove the cyan outer ring and glow from the active search box while preserving its border, background, and default-active behavior.
- Implementation screenshot: `/private/tmp/mclip-no-search-outer-ring.png`
- Focused side-by-side comparison: `/private/tmp/mclip-search-ring-comparison.png`
- Source viewport: `320 x 829` CSS px; source pixels: `640 x 1658`
- Implementation viewport: `320 x 861` CSS px; implementation pixels: `640 x 1722`
- Focused comparison: two `640 x 200` top regions separated by 16 px; output pixels: `1296 x 200`
- Density normalization: both captures are `2x`, so the focused regions required no resampling
- State: dark theme, main window freshly shown through the global shortcut, search focused and canonically active.

The full-window heights differ because mclip measures live clipboard content and the two captures contain different histories. The scoped search/header region has the same `320` CSS px width, density, theme, and active-search interaction state.

## Findings

- No actionable P0, P1, or P2 findings remain for the requested search-active treatment.
- The implementation removes both layers that produced the outer effect: the 3 px translucent shadow and shared focus ring.
- The search box remains visibly active through its single cyan accent border and selected background.
- No other main-window target is simultaneously highlighted.

## Required Fidelity Surfaces

- Fonts and typography: search icon, placeholder font family, weight, size, line height, truncation, and antialiasing remain unchanged.
- Spacing and layout rhythm: search height, header padding, icon inset, radius, brand alignment, and border placement remain unchanged. Removing the outer effect does not change geometry.
- Colors and visual tokens: the active search keeps `--mclip-accent-cool` on its 1 px border and `--mclip-surface` for its background. The translucent outer shadow and `focusRing` are no longer applied.
- Image quality and asset fidelity: the real mclip app icon and history thumbnails remain unchanged; no image or icon assets were generated or replaced.
- Copy and content: the localized search placeholder is unchanged. Live clipboard contents differ between captures but do not affect the header-state comparison.

## Full-View Comparison Evidence

The source and implementation full-window captures show the same compact header structure and active-search state. The implementation's content-driven height is 32 CSS px taller because its live list contains a different text/image mix; this is expected runtime behavior and outside the requested styling change.

## Focused Region Comparison Evidence

`/private/tmp/mclip-search-ring-comparison.png` places equal-size `640 x 200` header regions side by side. The left source visibly has a thick cyan outer ring and glow. The right implementation has only the intended thin cyan border, with matching typography, spacing, radius, background, and icon alignment.

## Comparison History

1. Earlier P2 finding: the default-active search box rendered a large double cyan outer ring, visually overpowering the compact header and differing from the selected treatment used elsewhere.
2. Fix: removed `shadow-[0_0_0_3px_rgba(115,208,200,0.16)]` and the shared `focusRing` from the active search classes; retained the accent border and selected surface.
3. Post-fix evidence: `/private/tmp/mclip-no-search-outer-ring.png` and `/private/tmp/mclip-search-ring-comparison.png` show the ring removed without a layout or interaction regression.

## Open Questions

- None for this scoped refinement.

## Implementation Checklist

- [x] Remove the active search outer shadow.
- [x] Remove the active search outer focus ring.
- [x] Preserve the accent border and selected background.
- [x] Verify the default-focused search state in the running Tauri app.
- [x] Compare equal-density header regions side by side.

## Follow-up Polish

- None required for this request.

final result: passed
