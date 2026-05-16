import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { DEFAULT_APP_VERSION } from "../constants";
import type { AppSettings } from "../types";

const HISTORY_UPDATED_EVENT = "history-updated";
const MAIN_WINDOW_SHOWN_EVENT = "main-window-shown";

export function getSettings() {
  return invoke<AppSettings>("get_settings");
}

export function saveSettings(settings: AppSettings) {
  return invoke<AppSettings>("save_settings", { settings });
}

export function getHistory() {
  return invoke<string[]>("get_history");
}

export function clearHistory() {
  return invoke<void>("clear_history");
}

export function adjustWindowHeight(
  itemCount: number,
  groupCount: number,
  previewItemCount: number,
) {
  return invoke<void>("adjust_window_height", {
    groupCount,
    itemCount,
    previewItemCount,
  });
}

export function copyToClipboard(content: string) {
  return invoke<void>("copy_to_clipboard", { content });
}

export function quitApp() {
  return invoke<void>("quit_app");
}

export function hideCurrentWindow() {
  return getCurrentWindow().hide();
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
  handler: (history: string[]) => void,
): Promise<UnlistenFn> {
  return listen<string[]>(HISTORY_UPDATED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToMainWindowShown(handler: () => void): Promise<UnlistenFn> {
  return listen(MAIN_WINDOW_SHOWN_EVENT, () => {
    handler();
  });
}
