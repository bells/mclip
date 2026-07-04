## 1. Tailwind Foundation Inventory

- [x] 1.1 Inventory `src/App.css` selectors and map each group to the owning React component or unavoidable global primitive.
- [x] 1.2 Confirm Tailwind v4 dependencies and `@tailwindcss/vite` are already present; avoid reinstalling unless the local lockfile proves they are missing.
- [x] 1.3 Decide the new Tailwind entrypoint path and update the implementation plan to delete `src/App.css` after migration.

## 2. Tailwind Theme Entrypoint

- [x] 2.1 Create the new thin Tailwind entrypoint with Tailwind import, config reference if needed, base reset, font smoothing, transparent-window background, and semantic theme tokens.
- [x] 2.2 Move dark/light theme variables into Tailwind-compatible tokens for surfaces, foreground, muted text, borders, accent, danger, focus, radii, and soft shadows.
- [x] 2.3 Update `src/main.tsx` to import the new Tailwind entrypoint without changing app bootstrap behavior.
- [x] 2.4 Run `npm run check:frontend` to catch import or token compile errors before component migration.

## 3. Main Window Shell Migration

- [x] 3.1 Refactor `src/App.tsx` so the `main` window shell uses Tailwind `h-screen`, vertical flex, `min-h-0`, and `overflow-hidden` ownership.
- [x] 3.2 Refactor the history scroll region so header and footer remain fixed while history and archive groups scroll within the intended flex child.
- [x] 3.3 Migrate `AppHeader`, search states, and focus styling to Tailwind utilities while preserving search focus preview dismissal.
- [x] 3.4 Migrate `HistoryList` rows, selected state, delete controls, thumbnails, color swatches, emoji display, and row-number visibility to Tailwind utilities.
- [x] 3.5 Migrate `HistoryGroupNav` archive group rows and active/hover states to Tailwind utilities without changing preview open/close handlers.
- [x] 3.6 Migrate `AppFooter` actions and clear/preference/about/quit states to Tailwind utilities while preserving keyboard target data and danger styling.

## 4. Shared Surfaces And Preview Windows

- [x] 4.1 Migrate `Modal` and `ErrorBoundary` surfaces to Tailwind utilities with visible focus and readable dark/light contrast.
- [x] 4.2 Migrate `HistoryPreviewWindow`, `HistoryItemPreviewWindow`, `HistoryGroupPreviewWindow`, `HistoryPreviewDetailWindow`, `HistoryDetailPanel`, and `HistoryPreviewDetailContent` to Tailwind utilities.
- [x] 4.3 Preserve `data-preview-item-id`, selected hover state, pointer polling behavior, preview selection events, and non-focusable preview window assumptions.
- [x] 4.4 Verify preview dimensions against `src/utils/preview.ts` and update JS tests if derived sizing changes.
- [x] 4.5 Migrate `DialogWindowFrame`, `DialogStatusBar`, `DialogWindowControls`, `AboutWindow`, and `PreferencesWindow` to Tailwind utilities while preserving drag-region boundaries and fixed dialog sizing.

## 5. Legacy CSS Removal

- [x] 5.1 Remove migrated selector blocks from the old stylesheet after each surface no longer depends on them.
- [x] 5.2 Run `rg "App\\.css|app-" src` and resolve remaining real styling dependencies, allowing only non-visual data attributes or intentional text matches.
- [x] 5.3 Delete `src/App.css` once it is no longer imported or needed.
- [x] 5.4 Recheck `src-tauri/src/window.rs` height constants and `src/utils/preview.ts` sizing helpers against the final Tailwind layout.

## 6. Verification

- [x] 6.1 Run `npm run check:frontend`.
- [x] 6.2 Run `node --test tests/*.test.mjs` if preview sizing, keyboard navigation, dismissal, or other JS helper behavior changed.
- [x] 6.3 Run `npm run check`.
- [x] 6.4 Run `git diff --check`.
- [ ] 6.5 Visually smoke test `main`, `preview`, `preview-detail`, `about`, and `preferences` in dark and light themes, including large history counts and archive group hover detail.
  - Attempted `npm run tauri:dev`; current environment reused an existing mclip single instance and exited before a debug window stayed open, so this still needs an interactive smoke pass after quitting the existing app.
