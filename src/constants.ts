// 前端常量与默认偏好。后端会做最终校验，这里用于界面初始值和输入约束。

import type { AppSettings } from "./types";

export const APP_NAME = "mclip";
export const APP_GITHUB_URL = "https://github.com/bells/mclip";
export const DEFAULT_APP_VERSION = "0.1.0";
export const HISTORY_GROUP_SIZE = 10;
export const ITEM_PREVIEW_WIDTH = 304;
export const GROUP_PREVIEW_WIDTH = 320;
export const GROUP_PREVIEW_GAP = 8;
export const GROUP_PREVIEW_DETAIL_WINDOW_WIDTH =
  GROUP_PREVIEW_GAP + ITEM_PREVIEW_WIDTH;
export const GROUP_PREVIEW_WITH_DETAIL_WIDTH =
  GROUP_PREVIEW_WIDTH + GROUP_PREVIEW_DETAIL_WINDOW_WIDTH;

export const MIN_MAX_HISTORY_COUNT = 10;
export const MAX_MAX_HISTORY_COUNT = 200;

export const DEFAULT_SETTINGS: AppSettings = {
  enabledHistoryTypes: {
    files: true,
    image: true,
    text: true,
  },
  language: "en",
  launchAtLogin: false,
  maxHistoryCount: 50,
};

export function clampHistoryCount(value: number) {
  // 手动输入和步进按钮共用同一套边界限制。
  return Math.min(MAX_MAX_HISTORY_COUNT, Math.max(MIN_MAX_HISTORY_COUNT, value));
}
