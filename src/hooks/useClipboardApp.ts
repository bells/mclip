// 主窗口状态中心：加载设置/历史、处理快捷键选择、驱动窗口高度和 preview 窗口联动。

import type { UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";

import {
  clampHistoryCount,
  DEFAULT_APP_VERSION,
  DEFAULT_SETTINGS,
  HISTORY_GROUP_SIZE,
} from "../constants";
import {
  adjustWindowHeight,
  clearHistory,
  copyToClipboard,
  getAppVersion,
  getHistory,
  getSettings,
  hideCurrentWindow,
  hideHistoryPreviewWindow,
  isPointerOverHistoryPreviewWindow,
  listenToHistoryPreviewCloseRequested,
  listenToHistoryPreviewPointerEntered,
  listenToHistoryUpdated,
  quitApp,
  saveSettings,
  showHistoryPreviewWindow,
  updateHistoryPreviewWindow,
} from "../lib/tauri";
import type { AppSettings, HistoryListItem } from "../types";
import {
  filterHistoryItems,
  getHistoryGroupItems,
  getHistoryGroups,
} from "../utils/history";
import { getTranslations } from "../i18n";

const PREVIEW_CLOSE_DELAY_MS = 500;

function normalizeSettings(settings: AppSettings): AppSettings {
  // 后端会校验一次，前端也归一化，确保旧配置不会污染界面状态。
  return {
    ...settings,
    language: settings.language === "zhCn" ? "zhCn" : "en",
    maxHistoryCount: clampHistoryCount(settings.maxHistoryCount),
  };
}

export function useClipboardApp() {
  const [appVersion, setAppVersion] = useState(DEFAULT_APP_VERSION);
  const [history, setHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsError, setSettingsError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [previewHistoryGroupIndex, setPreviewHistoryGroupIndex] = useState<number | null>(null);
  const [previewAnchorTop, setPreviewAnchorTop] = useState<number | null>(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const previewCloseTimerRef = useRef<number | null>(null);
  // Fast-path hint from preview-window events. The Rust hit test below remains
  // the final authority because the preview is a separate Tauri window.
  const isPreviewPointerInsideRef = useRef(false);
  const searchQueryRef = useRef(searchQuery);

  const filteredHistory = filterHistoryItems(history, searchQuery);
  const historyGroups = getHistoryGroups(filteredHistory.length, HISTORY_GROUP_SIZE);
  const visibleHistory = getHistoryGroupItems(
    filteredHistory,
    0,
    HISTORY_GROUP_SIZE,
  );
  const previewHistory = previewHistoryGroupIndex === null
    ? []
    : getHistoryGroupItems(filteredHistory, previewHistoryGroupIndex, HISTORY_GROUP_SIZE);

  // 事件回调里要读取最新搜索词，用 ref 避免闭包拿到旧值。
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    let isActive = true;
    let unlisten: UnlistenFn | undefined;

    const initializeApp = async () => {
      try {
        const [loadedSettings, initialHistory, version] = await Promise.all([
          getSettings(),
          getHistory(),
          getAppVersion(),
        ]);

        if (!isActive) {
          return;
        }

        const normalizedSettings = normalizeSettings(loadedSettings);
        setAppVersion(version);
        setSettings(normalizedSettings);
        setSettingsDraft(normalizedSettings);
        setHistory(initialHistory);
      } catch (error) {
        console.error("初始化应用失败:", error);
      }
    };

    const subscribeHistoryUpdates = async () => {
      try {
        unlisten = await listenToHistoryUpdated((updatedHistory) => {
          if (isActive) {
            setHistory(updatedHistory);
            if (searchQueryRef.current.trim() === "") {
              // 无搜索时新剪贴板内容进来，列表回到顶部并关闭旧 preview。
              setPreviewHistoryGroupIndex(null);
              setPreviewAnchorTop(null);
              setSelectedHistoryIndex(0);
            }
          }
        });
      } catch (error) {
        console.error("监听剪贴板历史更新失败:", error);
      }
    };

    void initializeApp();
    void subscribeHistoryUpdates();

    return () => {
      isActive = false;
      unlisten?.();
      if (previewCloseTimerRef.current !== null) {
        window.clearTimeout(previewCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let unlistenCloseRequested: UnlistenFn | undefined;
    let unlistenPointerEntered: UnlistenFn | undefined;

    void listenToHistoryPreviewCloseRequested(() => {
      isPreviewPointerInsideRef.current = false;
      closeHistoryGroupPreview();
    }).then((unsubscribe) => {
      unlistenCloseRequested = unsubscribe;
    });

    void listenToHistoryPreviewPointerEntered(() => {
      isPreviewPointerInsideRef.current = true;
      scheduleHistoryGroupPreviewClose();
    }).then((unsubscribe) => {
      unlistenPointerEntered = unsubscribe;
    });

    return () => {
      unlistenCloseRequested?.();
      unlistenPointerEntered?.();
    };
  }, []);

  useEffect(() => {
    // 内容条数变化后让 Rust 调整透明窗口高度；preview 已拆成独立窗口，主窗口宽度保持固定。
    void adjustWindowHeight(
      visibleHistory.length,
      historyGroups.length,
      previewHistory.length,
    ).catch((error) => {
      console.error("调整窗口高度失败:", error);
    });
  }, [historyGroups.length, previewHistory.length, visibleHistory.length]);

  useEffect(() => {
    setPreviewHistoryGroupIndex(null);
    setPreviewAnchorTop(null);
    setSelectedHistoryIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setPreviewHistoryGroupIndex(null);
      setPreviewAnchorTop(null);
    }
  }, [history.length, searchQuery]);

  useEffect(() => {
    if (
      previewHistoryGroupIndex !== null &&
      previewHistoryGroupIndex >= historyGroups.length
    ) {
      setPreviewHistoryGroupIndex(null);
      setPreviewAnchorTop(null);
    }
  }, [historyGroups.length, previewHistoryGroupIndex]);

  useEffect(() => {
    const previewGroup = historyGroups.find(
      (group) => group.index === previewHistoryGroupIndex,
    );

    if (previewAnchorTop === null || !previewGroup || previewHistory.length === 0) {
      void hideHistoryPreviewWindow().catch((error) => {
        console.error("隐藏历史分组预览失败:", error);
      });
      return;
    }

    void updateHistoryPreviewWindow({
      group: previewGroup,
      items: previewHistory,
      language: settings.language,
    })
      .then(() => showHistoryPreviewWindow(previewAnchorTop, previewHistory.length))
      .catch((error) => {
        console.error("显示历史分组预览失败:", error);
      });
  }, [
    historyGroups,
    previewAnchorTop,
    previewHistory,
    previewHistoryGroupIndex,
    settings.language,
  ]);

  useEffect(() => {
    setSelectedHistoryIndex((currentIndex) => {
      if (visibleHistory.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, visibleHistory.length - 1);
    });
  }, [visibleHistory.length]);

  const openAboutDialog = () => {
    setIsAboutOpen(true);
  };

  const closeAboutDialog = () => {
    setIsAboutOpen(false);
  };

  const openPreferencesDialog = () => {
    setSettingsDraft(settings);
    setSettingsError("");
    setIsPreferencesOpen(true);
  };

  const closePreferencesDialog = () => {
    if (!isSavingSettings) {
      setIsPreferencesOpen(false);
    }
  };

  const toggleLaunchAtLogin = () => {
    setSettingsDraft((current) => ({
      ...current,
      launchAtLogin: !current.launchAtLogin,
    }));
  };

  const updateMaxHistoryCount = (nextValue: number) => {
    setSettingsDraft((current) => ({
      ...current,
      maxHistoryCount: clampHistoryCount(nextValue),
    }));
  };

  const updateLanguage = (language: AppSettings["language"]) => {
    setSettingsDraft((current) => ({
      ...current,
      language,
    }));
  };

  const savePreferences = async () => {
    try {
      setIsSavingSettings(true);
      setSettingsError("");

      const normalizedSettings = normalizeSettings(settingsDraft);
      const savedSettings = normalizeSettings(await saveSettings(normalizedSettings));

      // 保存成功后用后端回读结果覆盖草稿，保证启动项等平台状态与界面一致。
      setSettings(savedSettings);
      setSettingsDraft(savedSettings);
      setIsPreferencesOpen(false);
    } catch (error) {
      console.error("保存设置失败:", error);
      setSettingsError(getTranslations(settingsDraft.language).preferences.error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const selectHistoryItem = async (text: string) => {
    try {
      setPreviewHistoryGroupIndex(null);
      setPreviewAnchorTop(null);
      await hideHistoryPreviewWindow();
      await copyToClipboard(text);
      await hideCurrentWindow();
    } catch (error) {
      console.error("复制历史记录失败:", error);
    }
  };

  const clearHistoryItems = async () => {
    try {
      await clearHistory();
      setHistory([]);
      setPreviewHistoryGroupIndex(null);
      setPreviewAnchorTop(null);
      setSelectedHistoryIndex(0);
    } catch (error) {
      console.error("清空历史失败:", error);
    }
  };

  const quit = async () => {
    try {
      await quitApp();
    } catch (error) {
      console.error("退出应用失败:", error);
    }
  };

  const hideWindow = async () => {
    try {
      setPreviewHistoryGroupIndex(null);
      setPreviewAnchorTop(null);
      await hideHistoryPreviewWindow();
      await hideCurrentWindow();
    } catch (error) {
      console.error("隐藏主窗口失败:", error);
    }
  };

  const moveSelection = (offset: number) => {
    if (visibleHistory.length === 0) {
      return;
    }

    setSelectedHistoryIndex((currentIndex) => {
      const lastIndex = visibleHistory.length - 1;
      const nextIndex = currentIndex + offset;

      if (nextIndex < 0) {
        return lastIndex;
      }

      if (nextIndex > lastIndex) {
        return 0;
      }

      return nextIndex;
    });
  };

  const selectHighlightedHistoryItem = async () => {
    const selectedItem = visibleHistory[selectedHistoryIndex];

    if (selectedItem) {
      await selectHistoryItem(selectedItem.text);
    }
  };

  const clearScheduledPreviewClose = () => {
    if (previewCloseTimerRef.current !== null) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
  };

  const openHistoryGroupPreview = (groupIndex: number, anchorTop: number) => {
    clearScheduledPreviewClose();
    isPreviewPointerInsideRef.current = false;
    setPreviewHistoryGroupIndex(groupIndex);
    setPreviewAnchorTop(anchorTop);
  };

  const closeHistoryGroupPreview = () => {
    clearScheduledPreviewClose();
    isPreviewPointerInsideRef.current = false;
    setPreviewHistoryGroupIndex(null);
    setPreviewAnchorTop(null);
  };

  const scheduleHistoryGroupPreviewClose = () => {
    clearScheduledPreviewClose();
    previewCloseTimerRef.current = window.setTimeout(() => {
      previewCloseTimerRef.current = null;

      // Keep polling while the pointer stays inside the preview. This lets the
      // user inspect and click grouped items without the preview disappearing
      // under the cursor.
      void isPointerOverHistoryPreviewWindow()
        .then((isPointerOverPreview) => {
          if (isPointerOverPreview) {
            isPreviewPointerInsideRef.current = true;
            scheduleHistoryGroupPreviewClose();
            return;
          }

          closeHistoryGroupPreview();
        })
        .catch((error) => {
          console.error("检测历史分组预览鼠标位置失败:", error);
          closeHistoryGroupPreview();
        });
    }, PREVIEW_CLOSE_DELAY_MS);
  };

  const selectedHistoryItem: HistoryListItem | undefined = visibleHistory[selectedHistoryIndex];

  return {
    appVersion,
    visibleHistory,
    historyGroups,
    hasHistory: history.length > 0,
    isAboutOpen,
    isPreferencesOpen,
    isSavingSettings,
    previewHistory,
    previewHistoryGroupIndex,
    searchQuery,
    selectedHistoryItem,
    settings,
    settingsDraft,
    settingsError,
    clearHistory: clearHistoryItems,
    closeAboutDialog,
    closePreferencesDialog,
    closeHistoryGroupPreview,
    hideWindow,
    moveSelection,
    openAboutDialog,
    openPreferencesDialog,
    quit,
    savePreferences,
    openHistoryGroupPreview,
    selectHighlightedHistoryItem,
    selectHistoryItem,
    setSearchQuery,
    scheduleHistoryGroupPreviewClose,
    toggleLaunchAtLogin,
    updateLanguage,
    updateMaxHistoryCount,
  };
}
