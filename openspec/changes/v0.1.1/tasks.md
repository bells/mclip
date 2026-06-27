# v0.1.1 Tasks

- [x] Add settings contract fields in Rust and TypeScript with defaults and sanitization.
- [x] Add focused tests for settings deserialization, defaults, and clamp behavior.
- [x] Replace single `HISTORY_GROUP_SIZE` usage with separate main-list and archive-group sizing.
- [x] Add pure history utility tests for mixed main/group counts.
- [x] Wire configurable counts through `useClipboardDataController`, `useHistoryPreviewController`, keyboard navigation, and window height adjustment.
- [x] Add Preferences controls for theme, main item count, archive group item count, and row number visibility.
- [x] Add Chinese and English i18n strings for all new settings and validation notes.
- [x] Implement shared theme resolution and theme token CSS for light/dark/system.
- [x] Ensure all five frontend windows receive the resolved theme.
- [x] Implement row-number hiding without leaving empty index columns.
- [x] Add frontend-only color-code and emoji classification helpers with tests.
- [x] Render color and emoji affordances in main rows, archive preview rows, and detail preview without changing copy-back text.
- [x] Replace broad dialog dragging with explicit status/title bar drag regions.
- [x] Update About and Preferences to use the shared status/title bar.
- [x] Mark the macOS light menu bar icon as an AppKit template image while preserving Windows behavior.
- [x] Add `mclip-cli --version`, `-V`, and `version` behavior.
- [x] Ensure top-level help/version do not require history file access.
- [x] Update CLI tests for help, version, and usage exit behavior.
- [x] Rework `install.sh` and `site/public/install.sh` to prefer prebuilt release binaries.
- [x] Update release workflow or release asset naming so installer URLs are stable.
- [x] Update README, AGENTS, site copy, and `llms.txt` for public CLI install behavior and new settings if implementation changes public docs.
- [x] Run `npm run check:frontend`, `node --test tests/*.test.mjs`, `npm run cli:test`, and `npm run check`.

## Additional Count And Main Window Layout Tasks

- [x] Replace the fixed main-window visible-count maximum with a dynamic `mainWindowItemCount <= maxHistoryCount` rule in TypeScript defaults/normalization and Rust settings sanitization.
- [x] Keep `historyGroupItemCount` on the compact `5..=20` range, with separate clamp helpers/tests so the main-window and archive-preview limits cannot drift together by accident.
- [x] Update Preferences so the main-window item count input/stepper uses `settingsDraft.maxHistoryCount` as its current maximum and reconciles `mainWindowItemCount` when `maxHistoryCount` is lowered.
- [x] Refactor the main window markup/CSS so the header and footer are fixed within the app panel while the history list and archive group navigation share a bounded vertical scroll region.
- [x] Update Rust main-window height calculation and positioning so large configured counts are capped to the current monitor work area and never place the top behind the macOS menu bar/status area or the bottom below the screen.
- [x] Preserve keyboard navigation and preview anchoring when the main content region scrolls, including `scrollIntoView({ block: "nearest" })` behavior for history rows, archive groups, and footer actions.
- [x] Add focused regression tests for dynamic main-count clamping, max-history reconciliation, scroll-container CSS, footer visibility assumptions, and large-count window-height clamping.
- [x] Visually verify a large main-window item count, such as `40`, on the dev app: the history area scrolls, the search header is visible, and every footer action is visible.

## Additional Light Theme Readability Tasks

- [x] Audit current light-theme token usage in `src/App.css`, especially raw
  amber/teal RGBA values used for readable text, labels, indices, placeholders,
  borders, selected rows, and focus states.
- [x] Add or refine semantic CSS tokens for light theme text, secondary text,
  tertiary text, row-leading numbers, detail metadata labels, surface layers,
  structural borders, selected rows, focus rings, and state colors.
- [x] Update `.app-item-index` and `.app-history-preview-index` so main-list and
  archive-preview numbers are readable in light theme across default, hover,
  selected, and keyboard-navigation states.
- [x] Update `.app-history-detail-meta dt`, `.app-history-preview-kicker`,
  `.app-modal-version`, `.app-settings-group-label`, `.app-settings-note`,
  `.app-menu-hint`, and `.app-search::placeholder` so readable labels do not use
  low-contrast dark-theme accent opacity values in light mode.
- [x] Adjust light-theme panel, preview, dialog, modal, settings, and footer
  surfaces so text is protected from busy wallpaper bleed-through without making
  the app feel heavy or decorative.
- [x] Keep color strategy restrained: teal for focus, selection, and current
  state; amber for limited hierarchy accents; semantic red/green/warning/info for
  state only.
- [x] Add a lightweight contrast regression test for named light-theme token
  pairs, covering normal text at 4.5:1 and row-number, metadata-label, icon,
  focus, selected, and border tokens at 3:1 or better where they convey UI
  structure or state.
- [ ] Visually verify light theme over a busy desktop background in the dev app:
  main window, archive group preview, item detail preview, preview-detail,
  About, Preferences, and clear-history modal.
- [x] Run `npm run check:frontend`, `node --test tests/*.test.mjs`, and
  `git diff --check`; run full `npm run check` before marking the appearance
  implementation complete.
