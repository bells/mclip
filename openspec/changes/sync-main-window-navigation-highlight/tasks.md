## 1. Active-Target Model and Regression Tests

- [x] 1.1 Extend `tests/keyboardNavigation.test.mjs` with cases for default search activation, active-target validation, pointer takeover, and Arrow Up/Arrow Down continuation from the latest pointer-activated target.
- [x] 1.2 Add or refine pure helpers in `src/utils/keyboardNavigation.ts` so the current rendered target list can validate and reconcile the canonical active target without changing existing order or wrap behavior.

## 2. Main-Window State and Input Coordination

- [x] 2.1 Refactor `src/App.tsx` from keyboard-specific selected-target state to one canonical main-window active-target state and synchronized ref.
- [x] 2.2 Reset the canonical target to search on initial mount and every main-window show event, focusing and selecting the search input as appropriate.
- [x] 2.3 Make Arrow Up and Arrow Down navigate from the canonical active target, focus and scroll the keyboard destination into view, and fall back to search when the previous target is no longer rendered.
- [x] 2.4 Add a deduplicated pointer-activation path that updates the canonical target only after real pointer movement and does not force DOM focus.

## 3. Unified Highlight and Preview Wiring

- [x] 3.1 Update `AppHeader` and `src/uiStyles.ts` so search exposes an explicit border-and-surface active style derived from the canonical target.
- [x] 3.2 Update `HistoryList`, `HistoryGroupNav`, and `AppFooter` to report focus/pointer activation through the shared callback contract and derive selected styles only from the canonical target.
- [x] 3.3 Synchronize target activation with preview behavior: history items and archive groups open their matching previews, while search and footer activation dismiss stale previews without making preview windows focusable.
- [x] 3.4 Add focused source-level or component contract tests proving only one target is styled active and that disabled footer actions cannot take pointer activation.
- [x] 3.5 Remove the outer keyboard focus ring from active history rows, archive groups, and footer actions while preserving their canonical selected surface.
- [x] 3.6 Remove the outer focus ring and glow from the active search box while preserving its canonical accent border and selected surface.

## 4. Verification

- [x] 4.1 Run `node --test tests/*.test.mjs` and resolve all focused navigation, styling, preview, and listener regressions.
- [x] 4.2 Run `npm run check` to validate the TypeScript/Vite frontend and the full Rust format, test, check, and clippy gate.
- [x] 4.3 Run `git diff --check` and review the final diff to confirm the change remains frontend-only and preserves the separate non-focusable preview-window model.
- [x] 4.4 Re-run focused styling tests, the full repository gate, screenshot design QA, strict OpenSpec validation, and `git diff --check` after removing the search outer ring.
