## 1. Group Preview Content Sizing

- [x] 1.1 Add a typed preview-size payload/event and pure normalization or deduplication helpers so the group window can report its rendered natural height to the main preview controller without resize loops.
- [x] 1.2 Measure the group header plus list content in `HistoryGroupPreviewWindow` after render and on relevant layout changes, while retaining the current compact formula only as the initial display fallback.
- [x] 1.3 Update `useHistoryPreviewController` to apply measured group height through a resize-only native path that preserves the current horizontal family placement and request-revision checks, and keep the title fixed with a scrollable list when Rust clamps the window to the monitor work area.
- [x] 1.4 Add focused tests for natural-height reporting, duplicate measurement suppression, anchor preservation, compact bottom spacing, and overflow scrolling.

## 2. Independent Group Item Detail Window

- [x] 2.1 Route pointer- and keyboard-activated group items through `updateHistoryPreviewDetailWindow` and `showHistoryPreviewDetailWindow`, using the shared `getItemPreviewHeight` rule and validating the active item before an asynchronous show completes.
- [x] 2.2 Simplify `HistoryGroupPreviewWindow` to render only the group title and rows, removing the embedded detail panel, combined-grid layout state, detail offset, and group-height expansion behavior.
- [x] 2.3 Keep `HistoryPreviewDetailWindow` synchronized with active-item payload, theme, placement side, pointer-enter/leave signals, and preview-family dismissal without making the window focusable.
- [x] 2.4 Remove the unused combined group/detail TypeScript wrapper, Rust command, sizing helper, styles, handler registration, and obsolete tests after confirming no remaining callers.
- [x] 2.5 Extend frontend and Rust window tests for independent detail height, rapid active-item changes, left/right placement, monitor boundary clamping, and pointer movement across both preview windows.

## 3. Detail-Owned Delete Action

- [x] 3.1 Extract a reusable presentational detail delete action and inject it through `HistoryDetailPanel.headerAction` in both `HistoryItemPreviewWindow` and `HistoryPreviewDetailWindow`.
- [x] 3.2 Implement archive-detail deletion with the existing typed `deleteHistoryItem` IPC, hiding the stale detail and clearing active hover state while the backend `history-updated` result refreshes main and group data.
- [x] 3.3 Remove the inline delete button, delete prop, trash-icon import, visibility state, and row action column from `HistoryGroupPreviewWindow` and its style helpers.
- [x] 3.4 Cover deletion from main and archive details, deletion refresh of a still-populated group, and closure of both windows when the group becomes empty.

## 4. Verification and Documentation Alignment

- [x] 4.1 Run the focused Node tests for preview sizing, deletion affordances, keyboard navigation, dismissal, and listener lifecycle, plus the focused Rust `window` tests.
- [x] 4.2 Run `npm run check` and `git diff --check`, resolving all TypeScript, formatting, Rust test/check, and clippy failures.
- [ ] 4.3 Run the Tauri app on macOS and manually verify the three reported screenshot paths: no trailing group blank space, delete only in detail, and compact independent text/image/file detail windows near both screen edges.
- [x] 4.4 Review `AGENTS.md` preview-window descriptions and targeted code comments, updating only statements made inaccurate by removing the combined group/detail path.
