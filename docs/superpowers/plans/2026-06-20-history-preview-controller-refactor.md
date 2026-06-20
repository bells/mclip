# History Preview Controller Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the history preview lifecycle from `src/hooks/useClipboardApp.ts` into `src/hooks/useHistoryPreviewController.ts` without changing preview behavior.

**Architecture:** `useClipboardApp.ts` remains the app orchestration hook. The new `useHistoryPreviewController` owns preview state, dismissal refs, timers, preview event listeners, and the show/hide effect. Inputs flow from app state into the controller; preview state/actions flow back to the app shell.

**Tech Stack:** React 19 hooks, TypeScript strict mode, existing Tauri IPC service facade, existing preview utility functions.

---

## File Structure

- Create: `src/hooks/useHistoryPreviewController.ts` — preview state and effects.
- Modify: `src/hooks/useClipboardApp.ts` — remove preview-specific state/effects and use the new hook.
- Test: existing typecheck, JS regression tests, diff hygiene, and full `npm run check`.

## Task 1: Extract the preview controller hook

**Files:**
- Create: `src/hooks/useHistoryPreviewController.ts`
- Modify: `src/hooks/useClipboardApp.ts`

- [ ] **Step 1: Run frontend typecheck baseline**

Run:

```bash
npm run check:frontend
```

Expected: PASS before editing.

- [ ] **Step 2: Create `src/hooks/useHistoryPreviewController.ts`**

Move preview state, preview dismissal helpers, preview event subscriptions, preview show/hide effect, and preview open/close actions from `useClipboardApp.ts` into this hook. The hook must export `useHistoryPreviewController` and return the same preview state/actions currently returned by `useClipboardApp.ts`.

The hook API must use this shape:

```ts
type UseHistoryPreviewControllerArgs = {
  filteredHistory: HistoryListItem[];
  historyGroups: HistoryGroupInfo[];
  settings: AppSettings;
  onMainWindowShown: () => void;
};

type UseHistoryPreviewControllerResult = {
  previewHistory: HistoryListItem[];
  previewHistoryGroupIndex: number | null;
  previewWindowSide: PreviewWindowSide | null;
  beginSelectionPreviewDismissal: () => void;
  clearPreviewState: () => void;
  closeHistoryGroupPreview: () => void;
  openHistoryGroupPreview: (groupIndex: number, anchorTop: number) => void;
  openHistoryItemPreview: (item: HistoryListItem, anchorTop: number) => void;
  resetSelectionPreviewDismissal: () => void;
  scheduleHistoryGroupPreviewClose: () => void;
};
```

- [ ] **Step 3: Update `src/hooks/useClipboardApp.ts`**

Remove imports that only support preview internals: `GROUP_PREVIEW_WIDTH`, `GROUP_PREVIEW_WITH_DETAIL_WIDTH`, `ITEM_PREVIEW_WIDTH`, `hideHistoryPreviewWindow`, `isPointerOverHistoryPreviewWindow`, preview event listeners, preview placement helpers, and preview dismissal helpers.

Import the new hook:

```ts
import { useHistoryPreviewController } from "./useHistoryPreviewController";
```

Call the hook after `filteredHistory`, `historyGroups`, and `visibleHistory` are available:

```ts
const {
  previewHistory,
  previewHistoryGroupIndex,
  previewWindowSide,
  beginSelectionPreviewDismissal,
  clearPreviewState,
  closeHistoryGroupPreview,
  openHistoryGroupPreview,
  openHistoryItemPreview,
  resetSelectionPreviewDismissal,
  scheduleHistoryGroupPreviewClose,
} = useHistoryPreviewController({
  filteredHistory,
  historyGroups,
  settings,
  onMainWindowShown: () => setSelectedHistoryIndex(-1),
});
```

Keep existing app action semantics: selecting, deleting, clearing history, opening dialogs, quitting, hiding the window, and keyboard selection must behave the same.

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

- [ ] **Step 7: Commit the hook extraction**

Run:

```bash
git add src/hooks/useClipboardApp.ts src/hooks/useHistoryPreviewController.ts docs/superpowers/plans/2026-06-20-history-preview-controller-refactor.md
git commit -m "refactor: extract history preview controller"
```

Expected: one implementation commit for the second-stage hook extraction and plan.

## Self-Review Notes

- Spec coverage: this plan extracts only preview lifecycle state/effects and keeps Rust, IPC names, preview sizes, and user-visible behavior unchanged.
- Placeholder scan: no unresolved markers or vague implementation slots.
- Type consistency: the hook API uses existing `AppSettings`, `HistoryGroupInfo`, `HistoryListItem`, and `PreviewWindowSide` types.
