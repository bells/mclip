# v0.1.1 Proposal

## Why

v0.1.0 has the core clipboard history workflow, but several visible behaviors are still fixed in code: the main list always shows 10 items, archive previews always use 10 items per group, row indices are always visible, and the app is effectively dark-only. The About and Preferences windows also feel less like native utility windows because the drag region is implicit across most non-interactive content.

v0.1.1 should turn these into explicit user preferences and polish the desktop shell without changing the local-first clipboard model.

The CLI installer also needs a better distribution path. The current public install script can fall back to cloning and building from source, which means users need Git, Rust, and Cargo. That is acceptable for development, but too heavy for a one-command public install.

## What Changes

- Add settings for:
  - main window visible history item count, default `10`;
  - archive group preview item count, default `10`;
  - whether row-leading history numbers are shown, default `true`;
  - appearance theme: follow system, light, dark, default follow system.
- Add the new controls in Preferences:
  - General: appearance theme;
  - Storage: main item count, archive group item count, row number visibility.
- Rework light and dark app themes through shared CSS tokens so main, preview, About, and Preferences stay visually coherent.
- Keep the existing `light` menu bar icon setting but make it use macOS native template image behavior on macOS so the menu bar can adapt to system appearance and wallpaper contrast.
- Add a clear draggable status/title bar to About and Preferences. Only that bar should start window dragging; content areas should not.
- Add frontend recognition for copied color codes and common emoji text so history rows and previews can display useful visual affordances without changing clipboard persistence or copy-back semantics.
- Add `mclip-cli --version` and tighten top-level and command-level help behavior.
- Change CLI installation so the preferred path downloads a prebuilt CLI binary for the current platform/arch. Keep source build as a development or fallback path only.

## Impact

Expected implementation areas:

- `src/types.ts`, `src/constants.ts`, `src/utils/settings.ts`
- `src-tauri/src/settings.rs`
- `src/hooks/useClipboardDataController.ts`, `src/hooks/useHistoryPreviewController.ts`, `src/utils/history.ts`, `src/utils/preview.ts`
- `src/components/HistoryList.tsx`, `src/components/HistoryGroupPreviewWindow.tsx`, `src/components/HistoryPreviewDetailContent.tsx`
- `src/components/PreferencesWindow.tsx`, `src/components/AboutWindow.tsx`, `src/components/DialogWindowFrame.tsx`, `src/utils/dialogDrag.ts`
- `src/App.css`, `src/i18n.ts`
- `src-tauri/src/lib.rs`, macOS tray icon handling
- `src-tauri/src/agent_cli.rs`, `src-tauri/tests/agent_cli.rs`
- `install.sh`, `site/public/install.sh`, release workflow or release assets
- README, AGENTS, site copy, and `llms.txt` if CLI install or setting surfaces change publicly.

## Non-Goals

- No cloud sync, account model, or remote clipboard storage.
- No change to history persistence format beyond additive settings fields.
- No change to text/image/file clipboard write-back semantics.
- No attempt to force macOS menu bar icon ordering.
- No full redesign of the tray window layout.
- No mobile implementation in this change; keep the settings contract mobile-friendly.

## Open Questions

- The proposal uses a conservative adjustable range of `5..=20` for both visible item counts. This can be widened later if real window-height testing is comfortable on smaller screens.
- The preferred CLI binary host can be GitHub Releases first, with the website script mirroring only the installer. If direct site-hosted binaries are desired, that should be a separate distribution decision.
