// 主窗口状态中心：加载设置/历史、处理快捷键选择、驱动窗口高度和 preview 窗口联动。

import type { UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_SETTINGS,
  HISTORY_GROUP_SIZE,
} from "../constants";
import {
  adjustWindowHeight,
  clearHistory,
  copyHistoryItem,
  deleteHistoryItem as deleteHistoryItemCommand,
  getHistory,
  getSettings,
  hideCurrentWindow,
  listenToHistoryUpdated,
  listenToSettingsUpdated,
  pasteClipboard,
  quitApp,
  showAboutWindow,
  showPreferencesWindow,
} from "../lib/tauri";
import type { AppSettings, HistoryEntry, HistoryListItem } from "../types";
import {
  filterHistoryItems,
  getHistoryGroupItems,
  getHistoryGroups,
} from "../utils/history";
import { getSearchQueryAfterHistorySelection } from "../utils/searchInteraction";
import { shouldAutoPasteAfterHistorySelection } from "../utils/selectionBehavior";
import { normalizeSettings } from "../utils/settings";
import { useHistoryPreviewController } from "./useHistoryPreviewController";

export function useClipboardApp() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const searchQueryRef = useRef(searchQuery);

  const filteredHistory = useMemo(
    () => filterHistoryItems(history, searchQuery),
    [history, searchQuery],
  );
  const historyGroups = useMemo(
    () => getHistoryGroups(filteredHistory.length, HISTORY_GROUP_SIZE),
    [filteredHistory.length],
  );
  const visibleHistory = useMemo(
    () => getHistoryGroupItems(filteredHistory, 0, HISTORY_GROUP_SIZE),
    [filteredHistory],
  );
  const {
    beginSelectionPreviewDismissal,
    clearPreviewState,
    closeHistoryGroupPreview,
    hidePreviewWindow,
    openHistoryGroupPreview,
    openHistoryItemPreview,
    previewHistory,
    previewHistoryGroupIndex,
    previewWindowSide,
    resetSelectionPreviewDismissal,
    scheduleHistoryGroupPreviewClose,
  } = useHistoryPreviewController({
    filteredHistory,
    historyGroups,
    onMainWindowShown: () => setSelectedHistoryIndex(-1),
    settings,
  });

  function clearSearchQueryAfterHistorySelection() {
    const nextSearchQuery = getSearchQueryAfterHistorySelection(searchQueryRef.current);
    searchQueryRef.current = nextSearchQuery;
    setSearchQuery(nextSearchQuery);
  }

  // 事件回调里要读取最新搜索词，用 ref 避免闭包拿到旧值。
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    let isActive = true;
    let unlisten: UnlistenFn | undefined;

    const initializeApp = async () => {
      try {
        const [loadedSettings, initialHistory] = await Promise.all([
          getSettings(),
          getHistory(),
        ]);

        if (!isActive) {
          return;
        }

        const normalizedSettings = normalizeSettings(loadedSettings);
        setSettings(normalizedSettings);
        setHistory(initialHistory);
      } catch (error) {
        console.error("初始化应用失败:", error);
      }
    };

    const subscribeHistoryUpdates = async () => {
      try {
        unlisten = await listenToHistoryUpdated((updatedHistory) => {
          if (isActive) {
            setHistory((currentHistory) => {
              const isLikelyClipboardInsert =
                updatedHistory.length >= currentHistory.length &&
                updatedHistory[0]?.id !== currentHistory[0]?.id;

              if (
                isLikelyClipboardInsert &&
                searchQueryRef.current.trim() === ""
              ) {
                // 无搜索时新剪贴板内容进来，列表回到顶部并关闭旧 preview。
                clearPreviewState();
                setSelectedHistoryIndex(-1);
              }

              return updatedHistory;
            });
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
    };
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    void listenToSettingsUpdated((updatedSettings) => {
      setSettings(normalizeSettings(updatedSettings));
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    // 内容条数变化后让 Rust 调整透明窗口高度；preview 已拆成独立窗口，主窗口宽度保持固定。
    void adjustWindowHeight(
      visibleHistory.length,
      historyGroups.length,
    ).catch((error) => {
      console.error("调整窗口高度失败:", error);
    });
  }, [historyGroups.length, visibleHistory.length]);

  useEffect(() => {
    clearPreviewState();
    setSelectedHistoryIndex(-1);
  }, [searchQuery]);

  useEffect(() => {
    setSelectedHistoryIndex((currentIndex) => {
      if (visibleHistory.length === 0) {
        return -1;
      }

      if (currentIndex < 0) {
        return -1;
      }

      return Math.min(currentIndex, visibleHistory.length - 1);
    });
  }, [visibleHistory.length]);

  const openAboutDialog = async () => {
    try {
      clearPreviewState();
      await hidePreviewWindow();
      await showAboutWindow();
    } catch (error) {
      console.error("打开关于窗口失败:", error);
    }
  };

  const openPreferencesDialog = async () => {
    try {
      clearPreviewState();
      await hidePreviewWindow();
      await showPreferencesWindow();
    } catch (error) {
      console.error("打开偏好设置窗口失败:", error);
    }
  };

  const selectHistoryItem = async (id: string) => {
    try {
      beginSelectionPreviewDismissal();
      await hidePreviewWindow();
      await copyHistoryItem(id);
      clearSearchQueryAfterHistorySelection();
      await hideCurrentWindow();

      if (shouldAutoPasteAfterHistorySelection(settings)) {
        await pasteClipboard();
      }
    } catch (error) {
      resetSelectionPreviewDismissal();
      console.error("复制历史记录失败:", error);
    }
  };

  const clearHistoryItems = async () => {
    try {
      await clearHistory();
      setHistory([]);
      clearPreviewState();
      setSelectedHistoryIndex(-1);
    } catch (error) {
      console.error("清空历史失败:", error);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      clearPreviewState();
      await hidePreviewWindow();

      const updatedHistory = await deleteHistoryItemCommand(id);
      setHistory(updatedHistory);
    } catch (error) {
      console.error("删除历史记录失败:", error);
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
      clearPreviewState();
      await hidePreviewWindow();
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
      if (currentIndex < 0) {
        return offset > 0 ? 0 : visibleHistory.length - 1;
      }

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
    if (selectedHistoryIndex < 0) {
      return;
    }

    const selectedItem = visibleHistory[selectedHistoryIndex];

    if (selectedItem) {
      await selectHistoryItem(selectedItem.id);
    }
  };

  const selectedHistoryItem: HistoryListItem | undefined =
    selectedHistoryIndex >= 0 ? visibleHistory[selectedHistoryIndex] : undefined;

  return {
    visibleHistory,
    historyGroups,
    hasHistory: history.length > 0,
    previewHistory,
    previewHistoryGroupIndex,
    previewWindowSide,
    searchQuery,
    selectedHistoryItem,
    settings,
    clearHistory: clearHistoryItems,
    closeHistoryGroupPreview,
    deleteHistoryItem,
    hideWindow,
    moveSelection,
    openAboutDialog,
    openPreferencesDialog,
    quit,
    openHistoryGroupPreview,
    openHistoryItemPreview,
    selectHighlightedHistoryItem,
    selectHistoryItem,
    setSearchQuery,
    scheduleHistoryGroupPreviewClose,
  };
}
