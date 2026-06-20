# Clipboard Data Controller Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract settings/history/search data ownership from `useClipboardApp.ts` into `useClipboardDataController.ts` without changing behavior.

**Architecture:** The new data controller owns history, settings, search query, subscriptions, and derived history values. `useClipboardApp.ts` composes the data controller with the existing preview controller and keeps app actions/selection/window-height orchestration.

**Tech Stack:** React 19 hooks, TypeScript strict mode, existing Tauri IPC service facade, existing history/search utility functions.

---

## File Structure

- Create: `src/hooks/useClipboardDataController.ts` — data state, subscriptions, derived history values.
- Modify: `src/hooks/useClipboardApp.ts` — consume the data controller and remove data-specific state/effects.
- Test: `npm run check:frontend`, `node --test tests/*.test.mjs`, `git diff --check`, `npm run check`.

## Task 1: Extract the clipboard data controller

**Files:**
- Create: `src/hooks/useClipboardDataController.ts`
- Modify: `src/hooks/useClipboardApp.ts`

- [ ] **Step 1: Run frontend typecheck baseline**

Run:

```bash
npm run check:frontend
```

Expected: PASS before editing.

- [ ] **Step 2: Create `src/hooks/useClipboardDataController.ts`**

Create a hook with this API:

```ts
type UseClipboardDataControllerArgs = {
  onLikelyClipboardInsert: () => void;
};

type UseClipboardDataControllerResult = {
  clearLocalHistory: () => void;
  clearSearchQueryAfterHistorySelection: () => void;
  filteredHistory: HistoryListItem[];
  hasHistory: boolean;
  historyGroups: HistoryGroupInfo[];
  replaceHistory: (updatedHistory: HistoryEntry[]) => void;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  settings: AppSettings;
  visibleHistory: HistoryListItem[];
};
```

The hook must preserve the current initialization, settings update, history update, search filtering, grouping, and search-clear behavior.

- [ ] **Step 3: Update `src/hooks/useClipboardApp.ts`**

Remove direct ownership of history/settings/search state and consume `useClipboardDataController`. Keep selected-row state and action functions in `useClipboardApp.ts`.

Use this callback shape when creating the data controller:

```ts
const clipboardData = useClipboardDataController({
  onLikelyClipboardInsert: () => {
    clearPreviewState();
    setSelectedHistoryIndex(-1);
  },
});
```

Then destructure returned values and replace `setHistory([])` with `clearLocalHistory()` and `setHistory(updatedHistory)` with `replaceHistory(updatedHistory)`.

- [ ] **Step 4: Run frontend typecheck**

Run:

```bash
npm run check:frontend
```

Expected: PASS.

- [ ] **Step 5: Run JS regressions**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run hygiene and full gate**

Run:

```bash
git diff --check
npm run check
```

Expected: both pass.

- [ ] **Step 7: Commit the data controller extraction**

Run:

```bash
git add src/hooks/useClipboardApp.ts src/hooks/useClipboardDataController.ts docs/superpowers/plans/2026-06-20-clipboard-data-controller-refactor.md
git commit -m "refactor: extract clipboard data controller"
```

Expected: one implementation commit for the third-stage data controller extraction and plan.

## Self-Review Notes

- Spec coverage: this plan extracts only data ownership and keeps preview, Rust, IPC payloads, and UI unchanged.
- Placeholder scan: no unresolved markers or vague implementation slots.
- Type consistency: the hook API uses existing `AppSettings`, `HistoryEntry`, `HistoryGroupInfo`, and `HistoryListItem` types.
