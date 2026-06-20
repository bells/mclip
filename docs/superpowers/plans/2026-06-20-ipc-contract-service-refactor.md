# IPC Contract Service Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the existing all-purpose Tauri frontend bridge into focused command, event, window, and app-version service modules without changing runtime behavior.

**Architecture:** Keep Rust command names and serialized payload shapes unchanged. Move frontend IPC concerns from `src/lib/tauri.ts` into `src/services/`, then keep `src/lib/tauri.ts` as a compatibility facade so current call sites continue compiling. This preserves the sensitive preview and clipboard paths while creating a cleaner seam for later hook and Rust module refactors.

**Tech Stack:** React 19, TypeScript strict mode, Tauri 2 frontend APIs, existing Rust commands returning `Result<T, String>`.

---

## File Structure

- Create: `src/services/ipc/commands.ts` — typed wrappers for `invoke` and `convertFileSrc`.
- Create: `src/services/ipc/events.ts` — typed `emitTo` and `listen` helpers plus private event names and window labels.
- Create: `src/services/ipc/windows.ts` — current-window helpers, drag helper, main-window hide, and current label lookup.
- Create: `src/services/appVersion.ts` — app version lookup with the existing fallback behavior.
- Modify: `src/lib/tauri.ts` — replace implementation with re-exports from the new service modules.
- Test: existing `npm run check:frontend`, `node --test tests/*.test.mjs`, and `npm run check` gates.

## Scope Guard

This implementation must not modify Rust files, Tauri window labels, command names, event names, preview geometry, clipboard behavior, settings persistence, CLI behavior, or user-visible UI. If a step appears to require changing those areas, stop and revisit the spec before editing.

### Task 1: Create focused IPC service modules

**Files:**
- Create: `src/services/ipc/commands.ts`
- Create: `src/services/ipc/events.ts`
- Create: `src/services/ipc/windows.ts`
- Create: `src/services/appVersion.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Run the baseline frontend typecheck**

Run:

```bash
npm run check:frontend
```

Expected: PASS before refactoring. If it fails, capture the existing error and do not mix unrelated fixes into this refactor.

- [ ] **Step 2: Create `src/services/ipc/commands.ts`**

Create this file with the command wrappers moved out of `src/lib/tauri.ts`. Keep command strings private to this module.

```ts
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

import type {
  AppSettings,
  AutoPastePermissionStatus,
  CliInstallStatus,
  HistoryEntry,
} from "../../types";

export type PreviewWindowSide = "left" | "right";

export type PreviewWindowPosition = {
  x: number;
  y: number;
  side: PreviewWindowSide;
};

export type ProjectLinkTarget = "github" | "homepage" | "latestRelease";

export type WindowPointerPosition = {
  x: number;
  y: number;
};

export function getSettings() {
  return invoke<AppSettings>("get_settings");
}

export function saveSettings(settings: AppSettings) {
  return invoke<AppSettings>("save_settings", { settings });
}

export function getCliInstallStatus() {
  return invoke<CliInstallStatus>("get_cli_install_status");
}

export function installCli() {
  return invoke<CliInstallStatus>("install_cli");
}

export function getHistory() {
  return invoke<HistoryEntry[]>("get_history");
}

export function clearHistory() {
  return invoke<void>("clear_history");
}

export function deleteHistoryItem(id: string) {
  return invoke<HistoryEntry[]>("delete_history_item", { id });
}

export function adjustWindowHeight(itemCount: number, groupCount: number) {
  return invoke<void>("adjust_window_height", {
    groupCount,
    itemCount,
  });
}

export function copyHistoryItem(id: string) {
  return invoke<void>("copy_history_item", { id });
}

export function pasteClipboard() {
  return invoke<void>("paste_current_clipboard");
}

export function openAutoPastePermissionSettings() {
  return invoke<void>("open_auto_paste_permission_settings");
}

export function getAutoPastePermissionStatus() {
  return invoke<AutoPastePermissionStatus>(
    "get_auto_paste_permission_status",
  );
}

export function getAssetUrl(path: string) {
  return convertFileSrc(path);
}

export function getImageBase64(path: string) {
  return invoke<string>("get_image_base64", { path });
}

export function showHistoryPreviewWindow(
  anchorTop: number,
  previewHeight: number,
  previewWidth: number,
  requiredPreviewWidth = previewWidth,
) {
  return invoke<PreviewWindowPosition>("show_history_preview_window", {
    anchorTop,
    previewHeight,
    previewWidth,
    requiredPreviewWidth,
  });
}

export function showHistoryGroupPreviewWithDetailWindow(
  groupX: number,
  groupY: number,
  previewHeight: number,
  groupWidth: number,
  detailWidth: number,
) {
  return invoke<PreviewWindowPosition>(
    "show_history_group_preview_with_detail_window",
    {
      detailWidth,
      groupWidth,
      groupX,
      groupY,
      previewHeight,
    },
  );
}

export function hideHistoryPreviewWindow() {
  return invoke<void>("hide_history_preview_window");
}

export function hideHistoryPreviewDetailWindow() {
  return invoke<void>("hide_history_preview_detail_window");
}

export function showHistoryPreviewDetailWindow(
  detailHeight: number,
  detailWidth: number,
  previewWidth: number,
) {
  return invoke<PreviewWindowPosition>("show_history_preview_detail_window", {
    detailHeight,
    detailWidth,
    previewWidth,
  });
}

export function showAboutWindow() {
  return invoke<void>("show_about_window");
}

export function showPreferencesWindow() {
  return invoke<void>("show_preferences_window");
}

export function openLogsDir() {
  return invoke<void>("open_logs_dir");
}

export function copyDiagnosticReport() {
  return invoke<void>("copy_diagnostic_report");
}

export function openIssueReport() {
  return invoke<void>("open_issue_report");
}

export function openProjectLink(target: ProjectLinkTarget) {
  return invoke<void>("open_project_link", { target });
}

export function writeClientLog(
  level: "info" | "warn" | "error",
  message: string,
  context?: string,
) {
  return invoke<void>("write_client_log", {
    context,
    level,
    message,
  });
}

export function isPointerOverHistoryPreviewWindow() {
  return invoke<boolean>("is_pointer_over_history_preview_window");
}

export function getHistoryPreviewPointerPosition() {
  return invoke<WindowPointerPosition | null>(
    "get_history_preview_pointer_position",
  );
}

export function quitApp() {
  return invoke<void>("quit_app");
}
```

- [ ] **Step 3: Create `src/services/ipc/events.ts`**

Create this file with event names, labels, emitters, and listeners moved out of `src/lib/tauri.ts`.

```ts
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AppSettings,
  HistoryEntry,
  HistoryItemPreviewPayload,
  HistoryPreviewGroupItemActivatedPayload,
  HistoryPreviewKeyboardNavigationPayload,
  HistoryPreviewPayload,
} from "../../types";
import type { PreviewWindowPosition } from "./commands";

const HISTORY_UPDATED_EVENT = "history-updated";
const SETTINGS_UPDATED_EVENT = "settings-updated";
const HISTORY_PREVIEW_UPDATED_EVENT = "history-preview-updated";
const HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT =
  "history-preview-placement-updated";
const HISTORY_PREVIEW_KEYBOARD_NAVIGATION_EVENT =
  "history-preview-keyboard-navigation";
const HISTORY_PREVIEW_GROUP_ITEM_ACTIVATED_EVENT =
  "history-preview-group-item-activated";
const HISTORY_PREVIEW_CLOSE_REQUESTED_EVENT = "history-preview-close-requested";
const HISTORY_PREVIEW_POINTER_ENTERED_EVENT = "history-preview-pointer-entered";
const HISTORY_PREVIEW_SELECTION_STARTED_EVENT =
  "history-preview-selection-started";
const HISTORY_PREVIEW_SELECTION_CANCELLED_EVENT =
  "history-preview-selection-cancelled";
const MAIN_WINDOW_SHOWN_EVENT = "main-window-shown";
const MAIN_WINDOW_LABEL = "main";
const PREVIEW_WINDOW_LABEL = "preview";
const PREVIEW_DETAIL_WINDOW_LABEL = "preview-detail";

export function updateHistoryPreviewWindow(payload: HistoryPreviewPayload) {
  return emitTo(PREVIEW_WINDOW_LABEL, HISTORY_PREVIEW_UPDATED_EVENT, payload);
}

export function updateHistoryPreviewDetailWindow(
  payload: HistoryItemPreviewPayload,
) {
  return emitTo(
    PREVIEW_DETAIL_WINDOW_LABEL,
    HISTORY_PREVIEW_UPDATED_EVENT,
    payload,
  );
}

export function sendHistoryPreviewKeyboardNavigation(
  payload: HistoryPreviewKeyboardNavigationPayload,
) {
  return emitTo(
    PREVIEW_WINDOW_LABEL,
    HISTORY_PREVIEW_KEYBOARD_NAVIGATION_EVENT,
    payload,
  );
}

export function notifyHistoryPreviewGroupItemActivated(
  payload: HistoryPreviewGroupItemActivatedPayload,
) {
  return emitTo(
    MAIN_WINDOW_LABEL,
    HISTORY_PREVIEW_GROUP_ITEM_ACTIVATED_EVENT,
    payload,
  );
}

export function requestHistoryPreviewClose() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_CLOSE_REQUESTED_EVENT);
}

export function notifyHistoryPreviewPointerEntered() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_POINTER_ENTERED_EVENT);
}

export function notifyHistoryPreviewSelectionStarted() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_SELECTION_STARTED_EVENT);
}

export function notifyHistoryPreviewSelectionCancelled() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_SELECTION_CANCELLED_EVENT);
}

export function listenToHistoryUpdated(
  handler: (history: HistoryEntry[]) => void,
): Promise<UnlistenFn> {
  return listen<HistoryEntry[]>(HISTORY_UPDATED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToSettingsUpdated(
  handler: (settings: AppSettings) => void,
): Promise<UnlistenFn> {
  return listen<AppSettings>(SETTINGS_UPDATED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToMainWindowShown(handler: () => void): Promise<UnlistenFn> {
  return listen(MAIN_WINDOW_SHOWN_EVENT, () => {
    handler();
  });
}

export function listenToHistoryPreviewUpdated(
  handler: (payload: HistoryPreviewPayload) => void,
): Promise<UnlistenFn> {
  return listen<HistoryPreviewPayload>(HISTORY_PREVIEW_UPDATED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToHistoryPreviewPlacementUpdated(
  handler: (placement: PreviewWindowPosition) => void,
): Promise<UnlistenFn> {
  return listen<PreviewWindowPosition>(
    HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToHistoryPreviewKeyboardNavigation(
  handler: (payload: HistoryPreviewKeyboardNavigationPayload) => void,
): Promise<UnlistenFn> {
  return listen<HistoryPreviewKeyboardNavigationPayload>(
    HISTORY_PREVIEW_KEYBOARD_NAVIGATION_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToHistoryPreviewGroupItemActivated(
  handler: (payload: HistoryPreviewGroupItemActivatedPayload) => void,
): Promise<UnlistenFn> {
  return listen<HistoryPreviewGroupItemActivatedPayload>(
    HISTORY_PREVIEW_GROUP_ITEM_ACTIVATED_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToHistoryPreviewCloseRequested(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(HISTORY_PREVIEW_CLOSE_REQUESTED_EVENT, () => {
    handler();
  });
}

export function listenToHistoryPreviewPointerEntered(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(HISTORY_PREVIEW_POINTER_ENTERED_EVENT, () => {
    handler();
  });
}

export function listenToHistoryPreviewSelectionStarted(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(HISTORY_PREVIEW_SELECTION_STARTED_EVENT, () => {
    handler();
  });
}

export function listenToHistoryPreviewSelectionCancelled(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(HISTORY_PREVIEW_SELECTION_CANCELLED_EVENT, () => {
    handler();
  });
}
```

- [ ] **Step 4: Create `src/services/ipc/windows.ts`**

Create this file with direct Tauri window API helpers.

```ts
import { getCurrentWindow, Window as TauriWindow } from "@tauri-apps/api/window";

const MAIN_WINDOW_LABEL = "main";

type TauriWindowMetadata = Window & {
  __TAURI_INTERNALS__?: {
    metadata?: {
      currentWindow?: {
        label?: string;
      };
    };
  };
};

export function hideCurrentWindow() {
  return getCurrentWindow().hide();
}

export function startCurrentWindowDrag() {
  return getCurrentWindow().startDragging();
}

export async function hideMainWindow() {
  const mainWindow = await TauriWindow.getByLabel(MAIN_WINDOW_LABEL);
  await mainWindow?.hide();
}

export function getCurrentWindowLabel() {
  return (
    (window as TauriWindowMetadata).__TAURI_INTERNALS__?.metadata?.currentWindow
      ?.label ?? MAIN_WINDOW_LABEL
  );
}
```

- [ ] **Step 5: Create `src/services/appVersion.ts`**

Create this file with the existing app-version fallback behavior.

```ts
import { getVersion } from "@tauri-apps/api/app";

import { DEFAULT_APP_VERSION } from "../constants";

export async function getAppVersion() {
  try {
    return await getVersion();
  } catch (error) {
    console.error("获取应用版本失败:", error);
    return DEFAULT_APP_VERSION;
  }
}
```

- [ ] **Step 6: Replace `src/lib/tauri.ts` with a compatibility facade**

Replace the file with these re-exports. This keeps all current imports working while the implementation moves to focused modules.

```ts
// Compatibility facade for Tauri IPC/window helpers.
// Prefer importing new code from src/services/ directly.

export * from "../services/appVersion";
export * from "../services/ipc/commands";
export * from "../services/ipc/events";
export * from "../services/ipc/windows";
```

- [ ] **Step 7: Run frontend typecheck after the split**

Run:

```bash
npm run check:frontend
```

Expected: PASS. If TypeScript reports missing exports, add the missing export to the correct service module rather than reintroducing implementation into `src/lib/tauri.ts`.

- [ ] **Step 8: Verify no TypeScript `any` was introduced**

Run:

```bash
rg -n "\\bany\\b|as any" src
```

Expected: no output. If output appears, replace the `any` with explicit types, `unknown`, or an existing union type.

- [ ] **Step 9: Commit the service split**

Run:

```bash
git add src/services src/lib/tauri.ts
git commit -m "refactor: split tauri bridge services"
```

Expected: one commit containing only the service split and facade.

### Task 2: Verify behavior-preserving refactor

**Files:**
- Inspect: `src/lib/tauri.ts`
- Inspect: `src/services/ipc/commands.ts`
- Inspect: `src/services/ipc/events.ts`
- Inspect: `src/services/ipc/windows.ts`
- Inspect: `src/services/appVersion.ts`

- [ ] **Step 1: Confirm the compatibility facade exports the previous public surface**

Run:

```bash
npm run check:frontend
```

Expected: PASS. This confirms existing callers still compile against `src/lib/tauri.ts`.

- [ ] **Step 2: Run existing JavaScript regression tests**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: PASS. These tests cover pure frontend behavior and guard against accidental import or module-resolution mistakes.

- [ ] **Step 3: Run whitespace hygiene**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 4: Run the full project gate**

Run:

```bash
npm run check
```

Expected: PASS. This includes frontend build, Rust formatting, Rust tests, Rust check, and clippy.

- [ ] **Step 5: Report the result**

Report the commit hash and verification commands. If `npm run check` fails in Rust without Rust edits, inspect whether the failure is unrelated before changing any Rust code.

## Self-Review Notes

- Spec coverage: Task 1 implements the focused service modules, compatibility facade, typed contract preservation, and no-behavior-change constraint. Task 2 implements verification.
- Placeholder scan: this plan has no unresolved markers or vague implementation slots.
- Type consistency: `PreviewWindowPosition`, `PreviewWindowSide`, `WindowPointerPosition`, and `ProjectLinkTarget` are exported from `commands.ts` because they describe command-facing payloads and are re-exported by the facade.
