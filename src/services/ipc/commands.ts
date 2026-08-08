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

export type PreviewFamilyPosition = {
  group: PreviewWindowPosition;
  detail: PreviewWindowPosition;
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

export function adjustWindowHeightToContent(contentHeight: number) {
  return invoke<void>("adjust_window_height_to_content", {
    contentHeight,
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

export function resizeHistoryPreviewWindow(previewHeight: number) {
  return invoke<PreviewWindowPosition>("resize_history_preview_window", {
    previewHeight,
  });
}

export function hideHistoryPreviewWindow() {
  return invoke<void>("hide_history_preview_window");
}

export function hideHistoryPreviewDetailWindow() {
  return invoke<void>("hide_history_preview_detail_window");
}

export function showImageViewerWindow() {
  return invoke<void>("show_image_viewer");
}

export function closeImageViewerWindow() {
  return invoke<void>("close_image_viewer");
}

export function toggleImageViewerMaximizeWindow() {
  return invoke<boolean>("toggle_image_viewer_maximize");
}

export function showHistoryPreviewDetailWindow(
  detailAnchorTop: number,
  detailHeight: number,
  detailWidth: number,
) {
  return invoke<PreviewFamilyPosition>("show_history_preview_detail_window", {
    detailAnchorTop,
    detailHeight,
    detailWidth,
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
