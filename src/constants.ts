// 前端常量与默认偏好。后端会做最终校验，这里用于界面初始值和输入约束。

import type { AppSettings } from "./types";

export const APP_NAME = "mclip";
export const DEFAULT_APP_VERSION = "0.1.0";
export const HISTORY_GROUP_SIZE = 10;

export const MIN_MAX_HISTORY_COUNT = 10;
export const MAX_MAX_HISTORY_COUNT = 200;

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  launchAtLogin: false,
  maxHistoryCount: 50,
};

export function clampHistoryCount(value: number) {
  // 手动输入和步进按钮共用同一套边界限制。
  return Math.min(MAX_MAX_HISTORY_COUNT, Math.max(MIN_MAX_HISTORY_COUNT, value));
}
