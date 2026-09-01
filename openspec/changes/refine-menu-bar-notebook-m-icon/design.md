## Context

The existing `menuBarIconStyle: "m"` option is backed by a 512×512 runtime PNG and a 128×128 Preferences preview PNG. Its artwork is a standalone handwritten lowercase `m`; Rust already marks it as a macOS Template Image, and Preferences saves the existing enum immediately through the shared settings flow.

The redesign crosses a visual source asset, two generated derivatives, localized Preferences copy, source-level verification, and native tray behavior. It must remain readable after the operating system reduces it to a roughly 16–22 px status item, where fine notebook details or a font-derived letter can blur together.

## Goals / Non-Goals

**Goals:**

- Express “mclip” and a note/clipboard concept through one compact notebook-with-`m` glyph.
- Preserve a clean monochrome silhouette, transparent background, native macOS tinting, and useful optical padding at small sizes.
- Make the runtime asset and Preferences preview deterministic derivatives of one canonical vector source.
- Preserve the current `m` setting value, immediate-save path, and platform behavior.
- Establish automated asset-contract checks plus explicit macOS and Windows visual smoke checks.

**Non-Goals:**

- Redesigning the application icon, the `appIcon` or `light` menu-bar choices, or the Preferences selector layout.
- Adding a fourth icon choice, changing the default style, or migrating saved settings.
- Changing tray click behavior, positioning, tooltip text, IPC contracts, or Tauri capabilities.
- Claiming automated tests prove native `SystemUIServer` or Windows Explorer rendering.

## Decisions

### Use a geometric notebook glyph rather than an illustrated notepad

The canonical artwork will use a square vector view box with:

- one rounded notebook/page outline;
- two restrained top-binding marks that remain distinct at status-item size;
- a custom geometric lowercase `m` centered inside the page;
- consistent stroke weight, rounded joins, and optical padding on every edge;
- transparent background and a single opaque foreground color.

The notebook outline and the `m` will be positive foreground geometry separated by transparent space. This keeps the letter open and recognizable after downscaling; a negative-space `m` inside a solid block was considered, but its narrow counters are more likely to close at 16–18 px. A realistic spiral, page lines, folded corner, shadow, gradient, and font glyph are excluded because they either add noise or make the result dependent on font rendering.

### Keep one source of truth and retain the existing derivative filenames

Add a canonical SVG beside the current tray assets, then generate the existing 512×512 runtime file and 128×128 Preferences file from it. Reuse the project’s installed Tauri CLI custom-PNG generation support from a small project script instead of adding another image-processing dependency. The generator will write predictable filenames and fail if output dimensions or image creation are invalid.

Keeping `menu-bar-icon-m.png` and `menu-bar-icon-m-128.png` avoids changes to Rust `include_bytes!` paths and React imports. It also makes rollback a direct asset revert.

### Preserve the settings and native rendering contract

`MenuBarIconStyle::M` and the TypeScript `"m"` union member remain unchanged. Rust will continue returning the redesigned runtime bytes for that value and treating it as a Template Image on macOS. Non-macOS targets continue using the redesigned raster through Tauri without calling macOS-only APIs.

Preferences will continue using the 128×128 derivative on its existing contrasting preview surface. Only the Chinese, English, and Japanese accessible description for the `m` option changes from “standalone m” wording to “notebook with m” wording; selection and immediate persistence remain untouched.

### Verify contracts automatically and appearance on native surfaces

Add a focused asset contract test that checks the canonical source and both required derivatives, their dimensions, transparent canvas, shared notebook/`m` source markers, Preferences preview import, and the Rust template-style mapping. Generate small reference previews at 16, 18, and 22 px on both light and dark backgrounds for implementation review.

Automated checks are followed by manual smoke tests: macOS menu bar in light/dark appearances (including Preferences selection and restart persistence), and Windows system tray at normal scaling. The Windows test confirms that the geometry remains recognizable; it does not imply native adaptive tinting.

## Risks / Trade-offs

- **[Notebook and `m` merge after downscaling]** → Use a geometric letter, minimum transparent separation, restrained binding detail, and inspect 16/18/22 px reference rasters before accepting the asset.
- **[A technically valid Template Image looks too heavy or too faint in a real menu bar]** → Tune optical stroke weight against native light and dark appearances; keep real macOS smoke separate from source checks.
- **[Runtime and Preferences images drift]** → Generate both derivatives from the same SVG and validate their dimensions and source pipeline in tests.
- **[Windows contrast differs from macOS because Explorer does not apply Template Image tinting]** → Include a Windows tray smoke task and keep any future platform-specific color derivative out of this change unless the native check demonstrates it is required.
- **[Asset tooling expands project complexity]** → Reuse the already installed Tauri CLI and a narrowly scoped generator; add no runtime dependency.

## Migration Plan

1. Add the canonical SVG and generation/validation path.
2. Replace both existing `m` PNG derivatives without renaming them.
3. Update localized accessible descriptions and focused tests.
4. Run repository gates, inspect small reference renders, then perform native menu-bar/tray smoke checks.

No data migration is required. Rollback restores the prior SVG/PNG assets and descriptions; persisted `"m"` values remain valid throughout.

## Open Questions

None. The requested concept, compatibility boundary, and verification targets are defined for implementation.
