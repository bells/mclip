# Maple icon verification — 2026-10-25

## Scope and selected source

The owner selected the second displayed concept. `src-tauri/icons/source/maple-app.png` is an unchanged copy of that generated image; its SHA-256 is documented beside it. This change is the icon phase on `v1.0.0`, preserving the earlier uncommitted tray repair and leaving updater/version/install work outside its scope.

## Automated evidence

- New asset tests first failed against the old green PNG/ICO identity and the old template. After export, they verify the warm palette, dimensions, transparent canvas, open m, matching color/template silhouettes and packed ICO/ICNS PNG representations.
- `pnpm run check`: frontend build, Rust fmt/test/check/clippy passed; Rust tests: 235 library + 21 CLI + 9 install passed, 3 synthetic benchmarks ignored.
- `node --test tests/*.test.mjs`: 235 passed, including the five new asset/container checks.
- `pnpm run site:test`: 16 passed. `pnpm run site:build`: six pages built successfully.
- Windows x64 `cargo xwin check --locked --offline ... --all-targets` passed. This establishes source compatibility, not Windows runtime behavior.
- Two successive exports were byte-identical across all 24 tracked root icon/website PNG/ICO/ICNS assets in the export audit. The initial repeat check found ICNS record ordering was unspecified; records contained identical bytes. Canonicalizing that container order resolved the difference, and tests preserve every record while checking order independence.
- The four notebook SVG/PNG SHA-256 values match the pre-change baseline and `HEAD`. Mobile resources, historical screenshots and versioned videos have no diff.
- Strict OpenSpec validation and `git diff --check` passed.

## Visual and browser evidence

- Inspected the generated `mclip-maple-icon-preview.png` from the system temporary directory: selected color mark, exact-silhouette white template, unchanged notebook and Windows/Linux contrast derivative; true 16/18/22/32px rasters and enlarged copies on light/dark simulated surfaces.
- The m remains distinguishable in these raster previews. The source includes a few extremely low-alpha pixels; the read-only reviewer found one visible connected component at alpha >= 32 and no visible isolated foreground patches warranting a repair.
- In-app browser at `http://127.0.0.1:4321/zh/`, 1280 × 720: header/footer `/app-icon.png` loaded at 1024px natural size and 32px rendered width. Screenshot shows the new rust maple and the deliberately retained v0.2.0 video.
- Pausing the demo changed its control to Play. Switching to English navigated to `/en/`, retained two loaded 32px brand images and produced no warning/error console entries. No framework error overlay or missing image was observed.
- A fresh read-only review found no supported high/medium-priority findings; it also checked all ICO frames and ICNS legacy RGB/alpha representations, plus localization/settings/logo regression tests.

## Acceptance boundaries

Native macOS menu-bar tint and switching between three saved selections remain unverified for this icon build. Windows and Linux native tray scaling/contrast remain unverified. At the time of this icon verification, no new app bundle was installed, no hosted website deployed, no version changed, and no commit/tag/push/archive performed. These exports, browser checks and cross-compilation do not close the native tasks.
