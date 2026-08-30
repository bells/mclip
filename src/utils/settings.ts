// 偏好设置工具：前端展示前先归一化，后端仍负责最终校验与持久化。

import {
  clampHistoryGroupItemCount,
  clampHistoryCount,
  clampMainWindowItemCount,
  DEFAULT_SETTINGS,
  MAX_IGNORED_SOURCE_APP_COUNT,
  MAX_SOURCE_APP_IDENTIFIER_LENGTH,
} from "../constants";
import type { AppLanguage, AppSettings, MenuBarIconStyle } from "../types";

const APP_LANGUAGES: readonly AppLanguage[] = ["system", "zhCn", "en"];
const MENU_BAR_ICON_STYLES: readonly MenuBarIconStyle[] = [
  "appIcon",
  "light",
  "m",
];

export function normalizeSettings(settings: AppSettings): AppSettings {
  const enabledHistoryTypes = {
    ...DEFAULT_SETTINGS.enabledHistoryTypes,
    ...settings.enabledHistoryTypes,
  };

  const maxHistoryCount = clampHistoryCount(settings.maxHistoryCount);
  const ignoredSourceAppIds = Array.from(
    new Set(
      (settings.ignoredSourceAppIds ?? [])
        .map((identifier) => identifier.trim().toLowerCase())
        .filter(
          (identifier) =>
            identifier.length > 0 &&
            identifier.length <= MAX_SOURCE_APP_IDENTIFIER_LENGTH &&
            /^[a-z0-9._:/\\-]+$/.test(identifier),
        ),
    ),
  ).slice(0, MAX_IGNORED_SOURCE_APP_COUNT);
  const textQuickActions = {
    json: settings.textQuickActions?.json !== false,
    base64: settings.textQuickActions?.base64 !== false,
    urlComponent: settings.textQuickActions?.urlComponent !== false,
  };

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    enabledHistoryTypes,
    language: APP_LANGUAGES.includes(settings.language)
      ? settings.language
      : DEFAULT_SETTINGS.language,
    maxHistoryCount,
    menuBarIconStyle: MENU_BAR_ICON_STYLES.includes(settings.menuBarIconStyle)
      ? settings.menuBarIconStyle
      : DEFAULT_SETTINGS.menuBarIconStyle,
    mainWindowItemCount: clampMainWindowItemCount(
      settings.mainWindowItemCount ?? DEFAULT_SETTINGS.mainWindowItemCount,
      settings.maxHistoryCount,
    ),
    historyGroupItemCount: clampHistoryGroupItemCount(
      settings.historyGroupItemCount ?? DEFAULT_SETTINGS.historyGroupItemCount,
    ),
    showHistoryItemNumbers: settings.showHistoryItemNumbers !== false,
    showMainWindowBrand: settings.showMainWindowBrand !== false,
    appearanceTheme:
      settings.appearanceTheme === "light" || settings.appearanceTheme === "dark"
        ? settings.appearanceTheme
        : "system",
    maskSensitiveContent: settings.maskSensitiveContent !== false,
    ignoredSourceAppIds,
    textQuickActions,
  };
}
