// 前端文案表。新增界面文案时在这里同时补中文和英文，组件只消费 translations。

import { APP_NAME } from "./constants";
import type { AppLanguage } from "./types";

export const translations = {
  zhCn: {
    about: {
      confirm: "确定",
      description: "一个轻量的跨平台剪贴板历史工具，基于 Tauri、React 和 Rust 构建。",
      title: `关于 ${APP_NAME}`,
      version: (version: string) => `版本 ${version}`,
    },
    clearHistoryConfirm: {
      cancel: "取消",
      confirm: "清除",
      message: "这会删除本机保存的全部剪贴板历史，操作无法撤销。",
      title: "清除所有历史？",
    },
    footer: {
      aboutHint: "查看版本信息",
      aboutLabel: `关于 ${APP_NAME}`,
      clearHint: "删除本地保存的记录",
      clearLabel: "清除历史",
      preferencesHint: "启动方式、语言与历史条数",
      preferencesLabel: "偏好设置",
      quitHint: "关闭托盘应用",
      quitLabel: "退出",
    },
    header: {
      searchPlaceholder: "搜索剪贴板历史...",
    },
    history: {
      empty: "等待复制内容...",
      groupAriaLabel: "更早的剪贴板历史",
      groupPreviewKicker: "历史分组",
      noMatches: "没有匹配的结果",
      previewAriaLabel: (start: number, end: number) => `历史分组 ${start}-${end}`,
    },
    preferences: {
      cancel: "取消",
      error: "保存失败，请重试。",
      languageDescription: "选择界面显示语言。",
      languageEnglish: "English",
      languageLabel: "语言",
      languageChinese: "中文",
      launchAtLoginDescription: `在系统登录后自动启动 ${APP_NAME}。`,
      launchAtLoginLabel: "登录时启动",
      maxHistoryCountAriaLabel: "最大记录条数",
      maxHistoryCountDescription: "控制本地历史列表最多保留多少条文本记录。",
      maxHistoryCountLabel: "最大记录条数",
      rangeNote: (min: number, max: number) => `可选范围 ${min} - ${max}`,
      save: "保存",
      saving: "保存中...",
      title: "偏好设置",
    },
  },
  en: {
    about: {
      confirm: "OK",
      description: "A lightweight cross-platform clipboard history app built with Tauri, React, and Rust.",
      title: `About ${APP_NAME}`,
      version: (version: string) => `Version ${version}`,
    },
    clearHistoryConfirm: {
      cancel: "Cancel",
      confirm: "Clear",
      message: "This deletes all clipboard history saved on this device. This cannot be undone.",
      title: "Clear all history?",
    },
    footer: {
      aboutHint: "View version info",
      aboutLabel: `About ${APP_NAME}`,
      clearHint: "Delete locally saved records",
      clearLabel: "Clear History",
      preferencesHint: "Startup, language, and history size",
      preferencesLabel: "Preferences",
      quitHint: "Close tray app",
      quitLabel: "Quit",
    },
    header: {
      searchPlaceholder: "Search clipboard history...",
    },
    history: {
      empty: "Waiting for copied content...",
      groupAriaLabel: "Older clipboard history",
      groupPreviewKicker: "History Group",
      noMatches: "No matching results",
      previewAriaLabel: (start: number, end: number) => `History group ${start}-${end}`,
    },
    preferences: {
      cancel: "Cancel",
      error: "Save failed. Please try again.",
      languageDescription: "Choose the display language.",
      languageEnglish: "English",
      languageLabel: "Language",
      languageChinese: "中文",
      launchAtLoginDescription: `Automatically start ${APP_NAME} after system login.`,
      launchAtLoginLabel: "Launch at login",
      maxHistoryCountAriaLabel: "Maximum history count",
      maxHistoryCountDescription: "Control the maximum number of local text records to keep.",
      maxHistoryCountLabel: "Maximum Records",
      rangeNote: (min: number, max: number) => `Range ${min} - ${max}`,
      save: "Save",
      saving: "Saving...",
      title: "Preferences",
    },
  },
} as const;

export type AppTranslations = (typeof translations)[AppLanguage];

export function getTranslations(language: AppLanguage): AppTranslations {
  // 防御旧配置或异常输入：未知语言统一回退英文。
  return translations[language] ?? translations.en;
}
