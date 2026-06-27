// 偏好设置工具：前端展示前先归一化，后端仍负责最终校验与持久化。

import {
  clampHistoryGroupItemCount,
  clampHistoryCount,
  clampMainWindowItemCount,
  DEFAULT_SETTINGS,
} from "../constants";
import type { AppSettings } from "../types";

export function normalizeSettings(settings: AppSettings): AppSettings {
  const enabledHistoryTypes = {
    ...DEFAULT_SETTINGS.enabledHistoryTypes,
    ...settings.enabledHistoryTypes,
  };

  const maxHistoryCount = clampHistoryCount(settings.maxHistoryCount);

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    enabledHistoryTypes,
    language: settings.language === "zhCn" ? "zhCn" : "en",
    maxHistoryCount,
    menuBarIconStyle:
      settings.menuBarIconStyle === "light" ? "light" : "appIcon",
    mainWindowItemCount: clampMainWindowItemCount(
      settings.mainWindowItemCount ?? DEFAULT_SETTINGS.mainWindowItemCount,
      settings.maxHistoryCount,
    ),
    historyGroupItemCount: clampHistoryGroupItemCount(
      settings.historyGroupItemCount ?? DEFAULT_SETTINGS.historyGroupItemCount,
    ),
    showHistoryItemNumbers: settings.showHistoryItemNumbers !== false,
    appearanceTheme:
      settings.appearanceTheme === "light" || settings.appearanceTheme === "dark"
        ? settings.appearanceTheme
        : "system",
  };
}
