# mclip Clipboard Data Controller Refactor Design

## Goal

Extract settings/history/search data ownership from `src/hooks/useClipboardApp.ts` into `src/hooks/useClipboardDataController.ts` without changing user-visible behavior.

## Scope

This third phase only moves frontend data orchestration. It does not change Rust commands, IPC payloads, preview behavior, window sizing rules, selection behavior, or UI rendering.

## Current Problem

After the preview controller extraction, `useClipboardApp.ts` still owns settings/history loading, history update subscriptions, search state, local history replacement after actions, and app-level actions. The file is smaller, but data ownership and app actions are still coupled.

## Proposed Architecture

Create `src/hooks/useClipboardDataController.ts`.

The new hook owns:

- `history`, `settings`, and `searchQuery` state;
- startup loading of settings/history;
- `history-updated` and `settings-updated` subscriptions;
- derived history values: filtered history, visible history, archive groups, and has-history flag;
- local history replacement helpers used after delete/clear actions;
- clearing the search query after history selection.

`useClipboardApp.ts` continues to own:

- selected row index and keyboard movement;
- preview controller wiring;
- app actions: select, clear, delete, open dialogs, hide, quit;
- window-height adjustment based on visible history and groups;
- the public return shape consumed by UI components.

## Data Flow

`useClipboardDataController` returns `filteredHistory`, `visibleHistory`, `historyGroups`, `hasHistory`, `settings`, `searchQuery`, `setSearchQuery`, `clearSearchQueryAfterHistorySelection`, `replaceHistory`, and `clearLocalHistory`.

When a likely new clipboard item arrives and the current search query is empty, the hook calls `onLikelyClipboardInsert`. `useClipboardApp.ts` uses that callback to clear preview state and reset selected row index, preserving the existing behavior.

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
- changing preview controller internals;
- changing history grouping or search behavior;
- changing settings persistence;
- changing UI markup.

## Implementation Decision

Extract only the data controller in this phase. Leave action extraction for a later phase so action behavior remains easy to compare with the current implementation.
