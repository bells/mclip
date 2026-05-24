// Tauri invoke/event 的前端封装。组件和 hook 只依赖这里，避免到处散落命令名和事件名。

import { getVersion } from "@tauri-apps/api/app";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow, Window as TauriWindow } from "@tauri-apps/api/window";

import { DEFAULT_APP_VERSION } from "../constants";
import type { AppSettings, HistoryEntry, HistoryPreviewPayload } from "../types";

const HISTORY_UPDATED_EVENT = "history-updated";
const SETTINGS_UPDATED_EVENT = "settings-updated";
const HISTORY_PREVIEW_UPDATED_EVENT = "history-preview-updated";
// Best-effort cross-window hover signals. Rust-side pointer hit testing covers
// cases where separate transparent windows miss mouse events.
const HISTORY_PREVIEW_CLOSE_REQUESTED_EVENT = "history-preview-close-requested";
const HISTORY_PREVIEW_POINTER_ENTERED_EVENT = "history-preview-pointer-entered";
const MAIN_WINDOW_SHOWN_EVENT = "main-window-shown";
const MAIN_WINDOW_LABEL = "main";
const PREVIEW_WINDOW_LABEL = "preview";

type TauriWindowMetadata = Window & {
  __TAURI_INTERNALS__?: {
    metadata?: {
      currentWindow?: {
        label?: string;
      };
    };
  };
};

export function getSettings() {
  return invoke<AppSettings>("get_settings");
}

export function saveSettings(settings: AppSettings) {
  return invoke<AppSettings>("save_settings", { settings });
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

export function adjustWindowHeight(
  itemCount: number,
  groupCount: number,
) {
  return invoke<void>("adjust_window_height", {
    groupCount,
    itemCount,
  });
}

export function copyHistoryItem(id: string) {
  return invoke<void>("copy_history_item", { id });
}

export function getAssetUrl(path: string) {
  return convertFileSrc(path);
}

export function getImageBase64(path: string) {
  return invoke<string>("get_image_base64", { path });
}

export function showHistoryPreviewWindow(
  anchorTop: number,
  itemCount: number,
  previewKind: HistoryPreviewPayload["kind"],
) {
  return invoke<void>("show_history_preview_window", {
    anchorTop,
    itemCount,
    previewKind,
  });
}

export function hideHistoryPreviewWindow() {
  return invoke<void>("hide_history_preview_window");
}

export function showAboutWindow() {
  return invoke<void>("show_about_window");
}

export function showPreferencesWindow() {
  return invoke<void>("show_preferences_window");
}

export function isPointerOverHistoryPreviewWindow() {
  return invoke<boolean>("is_pointer_over_history_preview_window");
}

export function updateHistoryPreviewWindow(payload: HistoryPreviewPayload) {
  return emitTo(PREVIEW_WINDOW_LABEL, HISTORY_PREVIEW_UPDATED_EVENT, payload);
}

export function requestHistoryPreviewClose() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_CLOSE_REQUESTED_EVENT);
}

export function notifyHistoryPreviewPointerEntered() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_POINTER_ENTERED_EVENT);
}

export function quitApp() {
  return invoke<void>("quit_app");
}

export function hideCurrentWindow() {
  return getCurrentWindow().hide();
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

export async function getAppVersion() {
  try {
    return await getVersion();
  } catch (error) {
    console.error("获取应用版本失败:", error);
    return DEFAULT_APP_VERSION;
  }
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
