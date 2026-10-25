## Context

The owner selected the second generated mark on 2026-10-25 after approving the icon brief. Existing Rust/TS values `appIcon`, `light`, `m` and the default `light` remain valid. Current frontend and website entrypoints already reference stable icon paths.

## Goals / Non-Goals

**Goals:** reproduce the selected rounded maple and flowing m faithfully, preserve transparency, generate desktop formats and matching template/contrast derivatives, and keep exports repeatable.

**Non-Goals:** settings migration, updater implementation, new bug work, version changes, website layout/theme changes, mobile product support, rewriting historical screenshots/videos, committing/pushing or replacing the installed app.

## Decisions

- Copy the exact selected Image Gen PNG to `src-tauri/icons/source/maple-app.png`; keep it as the canonical color source. Do not approximate its geometry with a new hand-drawn SVG.
- Use the existing official Tauri icon CLI to export desktop PNG/ICO/ICNS assets. Generate into a temporary directory and copy desktop outputs only; existing mobile artifacts are outside this change.
- Normalize only the ICNS frame order after export. The CLI emits the same frame contents in unspecified order; sorting the unchanged records makes repeated exports byte-identical without changing any image representation.
- Export monochrome PNGs by rendering the canonical image's alpha through an SVG color matrix. This is a deterministic export wrapper around the real source asset, not a replacement drawing. An Image Gen white conversion was examined and rejected because it introduced speckles and changed transparency. The export must preserve the selected m cutout.
- Use the same warm dark contrast surface as the maple palette for the Windows/Linux monochrome leaf. Preserve all notebook SVG/PNG bytes and its existing native rendering behavior.
- Keep stable public filenames, with one export command updating the 1024px website logo too. Preserve desktop imports and IPC routing; only the three language dictionaries need icon label/description changes.
- Keep the original v0.x videos, posters and historical product screenshots. Their old branding is historical evidence, not the current static logo.

## Risks / Trade-offs

- Raster concept edges and a narrow m can degrade at small sizes → inspect actual 16/18/22px rasters on light and dark surfaces, plus enlarged nearest-neighbor previews; check transparency/foreground coverage automatically.
- A stale ICO/ICNS or independent website copy can retain the old icon → check packed icon pixels and website output, not just one PNG.
- Re-running the notebook generator could restore the old leaf contrast plate → update only that generator's leaf plate colors and verify the notebook files remain byte-identical.
- Browser images and builds cannot establish native menu-bar contrast or installer acceptance → record those evidence boundaries separately.

## Migration Plan

No data migration. Existing `appIcon` users automatically see the new color asset; `light` users see the new template; `m` users retain the notebook. Revert generated assets and the export source to roll back the branding.
