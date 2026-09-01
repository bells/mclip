## 1. Canonical Icon and Derivatives

- [x] 1.1 Create a canonical square SVG with the rounded notebook outline, two restrained top-binding marks, and a custom geometric lowercase `m`, using monochrome foreground geometry and balanced transparent padding.
- [x] 1.2 Add a focused generation script/package command that reuses the installed Tauri CLI to produce the existing 512×512 `menu-bar-icon-m.png` and 128×128 `menu-bar-icon-m-128.png` filenames from the canonical SVG without adding an image runtime dependency.
- [x] 1.3 Generate 16×16, 18×18, and 22×22 light/dark reference previews, iterate on stroke weight and spacing until the notebook and `m` remain distinct, and present the final comparison for visual acceptance.

## 2. Preferences and Native Contract

- [x] 2.1 Update the Chinese, English, and Japanese `m` option descriptions to identify the notebook-with-`m` design while preserving the existing localized label and accessible option behavior.
- [x] 2.2 Preserve `menuBarIconStyle: "m"`, Rust/TypeScript enum symmetry, existing PNG import/include paths, immediate-save behavior, and the Rust Template Image mapping for both `light` and `m`.

## 3. Automated Verification

- [x] 3.1 Add focused asset-contract coverage for the canonical source, derivative dimensions/transparency, Preferences preview import, explicit vector geometry, and Rust `m` Template Image mapping.
- [x] 3.2 Run the generator twice and confirm the checked-in derivatives are reproducible and `git diff --check` is clean.
- [x] 3.3 Run `pnpm run check`, `node --test tests/*.test.mjs`, and `openspec validate refine-menu-bar-notebook-m-icon --type change --strict`.

## 4. Native Visual Smoke Tests

- [ ] 4.1 On macOS, select the redesigned `m` option, verify its Preferences preview and real menu-bar rendering in light and dark appearances, confirm selection persists after restart, and confirm tray click/show-hide behavior is unchanged.
  - 2026-09-01 boundary: the dev app launched successfully, but Computer Use timed out against both the LSUIElement app and `SystemUIServer`; source checks and preview rasters do not replace this manual interaction.
- [ ] 4.2 On a Windows device, verify the redesigned geometry is recognizable in the system tray at normal scaling and confirm the existing `m` setting selects it without invoking macOS-only behavior; record the test boundary if a Windows device is unavailable.
  - 2026-09-01 boundary: no Windows device is available from the current macOS host, so Explorer tray rendering remains unverified.
