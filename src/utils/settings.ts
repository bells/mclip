// 偏好设置工具：前端展示前先归一化，后端仍负责最终校验与持久化。

import {
  clampHistoryCount,
  clampVisibleItemCount,
  DEFAULT_SETTINGS,
} from "../constants";
import type { AppSettings } from "../types";

export function normalizeSettings(settings: AppSettings): AppSettings {
  const enabledHistoryTypes = {
    ...DEFAULT_SETTINGS.enabledHistoryTypes,
    ...settings.enabledHistoryTypes,
  };

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    enabledHistoryTypes,
    language: settings.language === "zhCn" ? "zhCn" : "en",
    maxHistoryCount: clampHistoryCount(settings.maxHistoryCount),
    menuBarIconStyle:
      settings.menuBarIconStyle === "light" ? "light" : "appIcon",
    mainWindowItemCount: clampVisibleItemCount(
      settings.mainWindowItemCount ?? DEFAULT_SETTINGS.mainWindowItemCount,
    ),
    historyGroupItemCount: clampVisibleItemCount(
      settings.historyGroupItemCount ?? DEFAULT_SETTINGS.historyGroupItemCount,
    ),
    showHistoryItemNumbers: settings.showHistoryItemNumbers !== false,
    appearanceTheme:
      settings.appearanceTheme === "light" || settings.appearanceTheme === "dark"
        ? settings.appearanceTheme
        : "system",
  };
}
