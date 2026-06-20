# mclip History Preview Controller Refactor Design

## Goal

Split the preview lifecycle out of `src/hooks/useClipboardApp.ts` into a focused React hook without changing preview behavior, Rust window commands, IPC payloads, or user-facing UI.

## Scope

This second phase targets only frontend orchestration around history preview state. It keeps Rust/Tauri commands, window labels, preview sizes, dismissal timing, and clipboard behavior unchanged.

## Current Problem

`useClipboardApp.ts` owns too many responsibilities at once: app initialization, settings/history loading, search state, selected-row navigation, history actions, and a large preview lifecycle. The preview code is especially sensitive because it coordinates delayed close timers, selection dismissal guards, and cross-window Tauri events.

After the first phase, IPC helpers are already split into focused service modules. That gives this phase a clean seam: `useClipboardApp.ts` can keep app-level orchestration while a new hook owns preview-specific state and side effects.

## Proposed Architecture

Create `src/hooks/useHistoryPreviewController.ts`.

The new hook owns:

- preview state: active group index, active item id, anchor top, and window side;
- preview dismissal state and pending close timer;
- preview open/close helpers;
- preview-related cross-window event listeners;
- the effect that emits preview payloads and asks Rust to show/hide preview windows;
- cleanup when search/history changes invalidate preview state.

`useClipboardApp.ts` continues to own:

- settings/history loading;
- search query and search-query ref;
- selected item index;
- history actions: select, copy, delete, clear;
- dialog/window actions;
- the public return shape consumed by `App.tsx` and child components.

The hook receives existing derived data and callbacks instead of importing app-level concerns directly. This keeps the dependency direction simple: `useClipboardApp.ts` orchestrates; preview controller manages preview.

## Data Flow

`useClipboardApp.ts` calculates `filteredHistory`, `historyGroups`, and `visibleHistory`. It passes `filteredHistory`, `historyGroups`, `settings.autoPaste`, and `settings.language` into `useHistoryPreviewController`.

`useHistoryPreviewController` derives `previewHistory` and `previewHistoryItem` from those inputs and its own preview state. It returns the preview data and commands needed by the app shell: open group/item preview, close preview, schedule close, begin/reset selection dismissal, clear preview state, and current preview window side.

## Error Handling

This phase preserves existing error behavior. Preview-related async failures should still be caught and logged at the same user-visible behavior level. The hook must not surface new UI errors or throw from effects.

## Testing and Verification

Because this is a behavior-preserving extraction, verification focuses on TypeScript correctness and existing regressions:

```bash
npm run check:frontend
node --test tests/*.test.mjs
git diff --check
npm run check
```

Add or update static tests only if existing tests are tied to old source locations. Do not add broad UI behavior changes in this phase.

## Out of Scope

This phase will not:

- change Rust window positioning or pointer hit testing;
- change preview sizes, delays, or event names;
- change history selection semantics;
- change settings/history loading behavior;
- introduce Zustand or another state library;
- split Rust modules.

## Implementation Decision

Extract only `useHistoryPreviewController` in this phase. Avoid a larger simultaneous split of history loading and app actions so the preview behavior remains easier to verify.
