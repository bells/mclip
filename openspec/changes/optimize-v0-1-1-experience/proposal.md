## Why

The v0.1.1 desktop experience still has avoidable visual looseness in the main history grouping and inconsistent control patterns in Preferences. The public CLI installer also fails against the current published Release state instead of reaching its documented source-build fallback, so the release and installation contract needs to be made observable and reliable before v0.1.1 is published.

## What Changes

- Tighten the vertical spacing between archive/history group rows in the main window while preserving row hit targets, keyboard navigation, and preview anchoring.
- Rework the Preferences General tab so Language, Appearance Theme, and Menu Bar Icon share one horizontal three-column strip, with each column's label and compact selector on the same line.
- Replace the menu bar icon radio-button preview group with a compact image-only dropdown that keeps the existing `menuBarIconStyle` values and immediate-save behavior.
- Preserve and regression-test the already-supported `mclip-cli --version` behavior (`mclip-cli 0.1.1`, exit status `0`, no history access); no new CLI flag is required.
- Make a missing latest-release CLI binary reliably enter the documented local/source-build fallback instead of being misclassified as a fatal transport error.
- Require the Release workflow and release-readiness checks to prove that every published CLI binary has its same-Release `.sha256` companion and that the public latest Release is actually installable before publication.
- Keep the root and website copies of `install.sh` byte-for-byte identical.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `history-display`: Require compact, consistent spacing for archive group navigation without weakening interaction behavior.
- `appearance-settings`: Require the three General appearance/language fields to share one aligned three-column row, including menu bar icon selection.
- `cli-distribution`: Make missing-asset fallback deterministic, preserve the version flag contract, and strengthen release asset completeness/readiness requirements.

## Impact

- Main-window history group layout in `src/uiStyles.ts` and `src/components/HistoryGroupNav.tsx`.
- Preferences General-tab rendering and styles in `src/components/PreferencesWindow.tsx` and `src/uiStyles.ts`, while leaving the existing settings IPC/data model unchanged.
- CLI regression coverage in `src-tauri/tests/agent_cli.rs`.
- Public installer behavior and tests for `install.sh` and `site/public/install.sh`.
- GitHub Release workflow checks in `.github/workflows/release.yml`, including asset/checksum verification for macOS ARM64 and Windows x64.
- Release verification must account for the current live state: published `v0.1.0` has no CLI assets, while draft `v0.1.1` has CLI binaries but currently exposes no companion `.sha256` assets.
