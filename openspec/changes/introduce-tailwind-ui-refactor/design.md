## Context

mclip is a tray-first desktop utility with a compact fixed-width main window plus independent transparent preview, preview-detail, About, and Preferences windows. Tailwind is already present in `package.json`, `vite.config.ts` includes `@tailwindcss/vite`, and `src/App.css` already imports Tailwind, but the real UI still depends on a large global stylesheet with `app-*` selectors, CSS variables, gradients, scroll rules, and component-specific state classes.

The refactor is cross-cutting because `src/App.css` styles the main shell, history rows, archive groups, preview windows, modal, error state, dialog chrome, About, and Preferences. It also touches layout sizing that has Rust/Tauri counterparts: previous main-window density work required checking `src-tauri/src/window.rs` constants and `src/utils/preview.ts` preview sizing helpers.

The design target from `ui-ux-pro-max` is Developer Tool / Minimalist UI: dense, operational, high contrast, OLED dark first, readable light mode, restrained accent color, visible focus, and soft shadows used for layer separation rather than decoration.

## Goals / Non-Goals

**Goals:**

- Move component styling from global selectors to Tailwind utility classes in the React components.
- Replace the old main-window body structure with a viewport-bounded flex shell: root height fills the window, header and footer remain stable, and the history area owns vertical scrolling.
- Keep one thin Tailwind entry file for Tailwind import, theme tokens, base reset, and unavoidable platform primitives such as scrollbar styling or Tauri transparent-window clipping.
- Delete `src/App.css` after no component imports or depends on its old selectors.
- Preserve current behavior for history selection, delete/clear, search, keyboard navigation, preview hover, preview dismissal, settings persistence, About actions, and theme switching.
- Keep all five windows visually coherent in dark, light, and system appearance modes.

**Non-Goals:**

- No changes to clipboard persistence, history data contracts, Rust IPC payloads, CLI behavior, or install scripts.
- No redesign into a landing page, dashboard, marketing surface, or large-window app.
- No migration of preview windows into the main DOM.
- No new animation framework or decorative motion system.
- No broad component library adoption unless implementation uncovers a specific repeated primitive that justifies it.

## Decisions

### Decision: Keep Tailwind v4 and the existing Vite plugin

Tailwind and `@tailwindcss/vite` are already configured. The implementation should complete the existing setup instead of reinstalling or replacing the stack.

Alternative considered: add a separate PostCSS/Tailwind pipeline. Rejected because the current Vite plugin is simpler and already aligned with the repo.

### Decision: Replace `App.css` with a new thin Tailwind entry

Create a new entry such as `src/styles.css` or `src/styles/tailwind.css`, import it from `src/main.tsx`, and delete `src/App.css` after migration. The new file may contain:

- `@import "tailwindcss";`
- the existing Tailwind config reference if still needed
- theme tokens for mclip colors, shadows, radii, and focus rings
- base rules for `:root`, `html`, `body`, `#root`, font smoothing, and Tauri transparent-window background
- very small utility/base rules for platform surfaces that cannot be expressed safely inline, such as themed scrollbar treatment

It must not become a renamed copy of the old global component stylesheet.

Alternative considered: keep `App.css` as the Tailwind entry and remove old selectors in place. Rejected because the user explicitly asked to delete the old CSS file after migrating.

### Decision: Use component-local Tailwind class strings, not global component selectors

Component markup should carry the visual contract through Tailwind utilities. Repeated patterns can use small TypeScript class constants or focused helper functions when they reduce duplication, but shared helpers should still expand to Tailwind utilities rather than global CSS classes.

Alternative considered: define large semantic classes through `@apply`. Rejected because it recreates the same global coupling and makes the deletion of old CSS less meaningful.

### Decision: Make the app shell flex-owned and scroll-contained

The main window should use a stable structure equivalent to:

- outer frame: `h-screen overflow-hidden`
- panel: `flex h-full min-h-0 flex-col overflow-hidden`
- header: fixed flex child
- history region: `min-h-0 flex-1 overflow-y-auto overflow-x-hidden`
- footer: fixed flex child

The current `app-body` behavior should be replaced by this flex model so large history counts cannot collapse the body or push footer/header offscreen.

Alternative considered: keep the existing scroll region and only translate its CSS to Tailwind classes. Rejected because the requested first step is specifically to let the Tailwind flex shell own the layout and prevent height/scroll bugs.

### Decision: Tokenize the visual direction once, apply everywhere

Use semantic Tailwind theme tokens for surfaces, foreground, muted text, borders, accent, danger, focus, and soft elevation. The dark theme should use near-black/OLED surfaces with subtle raised layers; light mode should remain readable and avoid beige washout. Preview, dialog, modal, and main surfaces should use the same token family.

Alternative considered: hardcode raw color utilities in every component. Rejected because it makes dark/light parity and future appearance setting changes brittle.

### Decision: Preserve existing Tauri window boundaries

The Tailwind migration must keep `main`, `preview`, `preview-detail`, `about`, and `preferences` as separate windows. Preview and preview-detail remain non-focusable and continue using Rust-side pointer hit testing. Tailwind classes can restyle their content, but the cross-window interaction model stays unchanged.

Alternative considered: simplify preview layout by rendering it inside the main app DOM. Rejected because it violates mclip's window model and would reintroduce main-window width/hover problems.

## Risks / Trade-offs

- [Risk] Tailwind class strings become hard to scan in dense TSX files. -> Mitigation: extract repeated class groups into small local constants, keep component boundaries focused, and avoid generic utility abstractions.
- [Risk] Removing old selectors breaks hidden states such as keyboard-navigation hover suppression, selected rows, preview hover detail, disabled controls, or dialog drag regions. -> Mitigation: migrate by surface, keep state/data attributes intact, and test affected interaction paths after each surface.
- [Risk] Visual compactness changes actual window height. -> Mitigation: compare rendered density with `src-tauri/src/window.rs` constants and `src/utils/preview.ts`; update tests when helper sizing changes.
- [Risk] Tailwind dark/light tokens reduce contrast or lose wallpaper protection in transparent windows. -> Mitigation: verify both appearance modes on main, preview, preview-detail, About, Preferences, and modal surfaces; keep panel backgrounds opaque enough for readability.
- [Risk] Deleting `App.css` too early causes broad regressions. -> Mitigation: delete it only after `rg "App\\.css|app-" src` no longer shows real styling dependencies, then run build and full checks.

## Migration Plan

1. Inventory `src/App.css` selectors and map them to owning components or global primitives.
2. Create the new Tailwind entry file and update `src/main.tsx` to import it.
3. Refactor the main window shell first: `App.tsx`, `AppHeader`, `HistoryList`, `HistoryGroupNav`, and `AppFooter`.
4. Refactor modal and error surfaces.
5. Refactor preview family surfaces while preserving event names, state classes/data attributes, and independent Tauri windows.
6. Refactor About, Preferences, and shared dialog chrome.
7. Remove obsolete global selectors incrementally, then delete `src/App.css`.
8. Run targeted and full verification: `npm run check:frontend`, `node --test tests/*.test.mjs` if sizing/helper logic changed, `npm run check`, and `git diff --check`.
9. Do visual smoke checks for main, preview, preview-detail, About, and Preferences in dark and light themes.

Rollback strategy: keep the change staged in small commits or phases during implementation. If a surface regresses, revert that surface's component changes and keep the new Tailwind entry only if it does not affect runtime behavior.

## Open Questions

- Whether implementation should keep the new Tailwind entry at `src/styles.css` or under `src/styles/tailwind.css`; either is acceptable if `src/App.css` is deleted.
- Whether to introduce a tiny class name helper such as `clsx`. Prefer plain template strings unless repeated conditional class composition becomes noisy during implementation.
