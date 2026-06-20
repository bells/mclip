# mclip Clipboard Actions Refactor Design

## Goal

Finish the current frontend refactor by extracting app-level clipboard actions from `src/hooks/useClipboardApp.ts` into `src/hooks/useClipboardActions.ts` without changing behavior.

## Scope

This phase only moves action functions. It does not change Rust commands, IPC payloads, preview behavior, data loading, selection movement, or UI rendering.

## Current Problem

`useClipboardApp.ts` now composes the data controller and preview controller, but it still owns all async app actions: select, clear, delete, hide, quit, and opening dialogs. These actions depend on preview and data controller callbacks, which makes the app hook longer than necessary.

## Proposed Architecture

Create `src/hooks/useClipboardActions.ts`.

The new hook owns:

- opening About and Preferences dialogs;
- selecting a history item;
- clearing history;
- deleting a history item;
- hiding the main window;
- quitting the app;
- selecting the currently highlighted item.

`useClipboardApp.ts` keeps:

- selected index state and keyboard movement;
- data controller composition;
- preview controller composition;
- window-height adjustment;
- the public return shape for UI consumers.

## Data Flow

`useClipboardApp.ts` passes the action hook the current settings, visible history, selected index, data mutation callbacks, preview callbacks, and selected-index reset callback. The action hook returns the same action names currently returned by `useClipboardApp.ts`.

## Testing and Verification

Run:

```bash
npm run check:frontend
node --test tests/*.test.mjs
git diff --check
npm run check
```

## Out of Scope

- splitting Rust modules;
- changing action semantics;
- adding user-visible error UI;
- changing preview lifecycle;
- changing selection movement logic.

## Implementation Decision

Extract only app actions in this phase. Treat this as the final frontend refactor stage unless a future task explicitly asks to split Rust modules or add tests for new behavior.
