## Why

mclip already has Tailwind dependencies and the Vite Tailwind plugin, but the UI still depends on a large global `App.css` with many `app-*` selectors. This makes layout bugs, theme drift, and scroll containment issues harder to reason about, especially in the compact tray window and independent preview windows.

## What Changes

- Complete the Tailwind CSS adoption by moving the main app UI and shared window surfaces to Tailwind utility classes.
- Rebuild the main window shell around a viewport-bounded flex layout, with the equivalent of `h-screen flex flex-col overflow-hidden` owning the app body instead of legacy height and scroll CSS.
- Establish a minimal Tailwind theme foundation for Developer Tool / Minimalist UI, OLED dark surfaces, readable light mode, soft depth, focus states, and compact spacing.
- Preserve the existing five-window Tauri model: `main`, `preview`, `preview-detail`, `about`, and `preferences`.
- Keep preview windows independent and non-focusable; the Tailwind refactor must not move preview/detail UI back into the main DOM.
- Replace old global component selectors with Tailwind atomic classes or narrowly scoped reusable class helpers, then delete the old `src/App.css` file after the migrated UI no longer depends on it.
- Maintain existing product behavior for clipboard history, preview hover, keyboard navigation, preferences, About, and theme switching.

## Capabilities

### New Capabilities

- `tailwind-ui-foundation`: Defines the Tailwind-based styling and layout foundation for mclip windows, including the main shell, tokenized dark/light themes, compact spacing, soft elevation, scroll containment, and legacy CSS removal expectations.

### Modified Capabilities

- None. Existing behavior specs for appearance settings, history display, dialog chrome, and CLI distribution should remain behaviorally compatible; this change updates the styling foundation and layout implementation rather than changing those user-facing contracts.

## Impact

- Frontend styling entrypoint: replace `src/App.css` with a thin Tailwind entry/theme file or equivalent, and update `src/main.tsx` imports.
- React components: migrate `src/App.tsx`, main-window components, preview components, About, Preferences, Modal, ErrorBoundary, and shared dialog chrome away from `app-*` selector dependence.
- Tailwind config/theme: extend tokens only where needed for mclip surfaces, colors, shadows, focus rings, and scrollbar treatment.
- Rust/Tauri sizing: verify whether `src-tauri/src/window.rs` height constants and `src/utils/preview.ts` derived sizing still match the new compact Tailwind layout.
- Tests and checks: run frontend checks, JS layout/helper tests where affected, `npm run check`, and `git diff --check`; visually verify main, preview, preview-detail, About, and Preferences windows in dark and light themes.
