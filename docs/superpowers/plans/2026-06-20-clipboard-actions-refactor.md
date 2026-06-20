# Clipboard Actions Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract app-level clipboard actions from `useClipboardApp.ts` into `useClipboardActions.ts` as the final frontend refactor stage.

**Architecture:** `useClipboardActions` receives current controller state and callbacks, owns async action functions, and returns the same public actions currently returned by `useClipboardApp.ts`. `useClipboardApp.ts` remains the composition layer.

**Tech Stack:** React 19 hooks, TypeScript strict mode, existing Tauri IPC services, existing selection behavior utility.

---

## File Structure

- Create: `src/hooks/useClipboardActions.ts` — action functions.
- Modify: `src/hooks/useClipboardApp.ts` — consume the actions hook and remove direct Tauri/action imports.
- Test: `npm run check:frontend`, `node --test tests/*.test.mjs`, `git diff --check`, `npm run check`.

## Task 1: Extract clipboard app actions

**Files:**
- Create: `src/hooks/useClipboardActions.ts`
- Modify: `src/hooks/useClipboardApp.ts`

- [ ] **Step 1: Run frontend typecheck baseline**

Run:

```bash
npm run check:frontend
```

Expected: PASS before editing.

- [ ] **Step 2: Create `src/hooks/useClipboardActions.ts`**

Create a hook that accepts settings, visible history, selected index, data callbacks, preview callbacks, and selection reset callback. It returns `openAboutDialog`, `openPreferencesDialog`, `selectHistoryItem`, `clearHistory`, `deleteHistoryItem`, `quit`, `hideWindow`, and `selectHighlightedHistoryItem`.

- [ ] **Step 3: Update `src/hooks/useClipboardApp.ts`**

Remove action-specific imports and local action functions. Call `useClipboardActions` after data and preview controllers are available, then return the action functions from that hook.

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

- [ ] **Step 7: Commit the actions extraction**

Run:

```bash
git add src/hooks/useClipboardApp.ts src/hooks/useClipboardActions.ts docs/superpowers/plans/2026-06-20-clipboard-actions-refactor.md
git commit -m "refactor: extract clipboard actions"
```

Expected: one implementation commit for the final frontend action extraction and plan.

## Self-Review Notes

- Spec coverage: this plan extracts only app actions and keeps Rust, preview, data loading, selection movement, and UI unchanged.
- Placeholder scan: no unresolved markers or vague implementation slots.
- Type consistency: the hook API uses existing `AppSettings`, `HistoryEntry`, and `HistoryListItem` types.
