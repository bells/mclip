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
  copyToClipboard,
  getHistory,
  getSettings,
  hideCurrentWindow,
  hideHistoryPreviewWindow,
  isPointerOverHistoryPreviewWindow,
  listenToHistoryPreviewCloseRequested,
  listenToHistoryPreviewPointerEntered,
  listenToHistoryUpdated,
  listenToSettingsUpdated,
  quitApp,
  showAboutWindow,
  showHistoryPreviewWindow,
  showPreferencesWindow,
  updateHistoryPreviewWindow,
} from "../lib/tauri";
import type { AppSettings, HistoryListItem } from "../types";
import {
  filterHistoryItems,
  getHistoryGroupItems,
  getHistoryGroups,
} from "../utils/history";
import { normalizeSettings } from "../utils/settings";

const PREVIEW_CLOSE_DELAY_MS = 500;

export function useClipboardApp() {
  const [history, setHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [previewHistoryGroupIndex, setPreviewHistoryGroupIndex] = useState<number | null>(null);
  const [previewAnchorTop, setPreviewAnchorTop] = useState<number | null>(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const previewCloseTimerRef = useRef<number | null>(null);
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
  const previewHistory = useMemo(
    () =>
      previewHistoryGroupIndex === null
        ? []
        : getHistoryGroupItems(
            filteredHistory,
            previewHistoryGroupIndex,
            HISTORY_GROUP_SIZE,
          ),
    [filteredHistory, previewHistoryGroupIndex],
  );

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
    let unlistenCloseRequested: UnlistenFn | undefined;
    let unlistenPointerEntered: UnlistenFn | undefined;

    void listenToHistoryPreviewCloseRequested(() => {
      closeHistoryGroupPreview();
    }).then((unsubscribe) => {
      unlistenCloseRequested = unsubscribe;
    });

    void listenToHistoryPreviewPointerEntered(() => {
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
    ).catch((error) => {
      console.error("调整窗口高度失败:", error);
    });
  }, [historyGroups.length, visibleHistory.length]);

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

  const openAboutDialog = async () => {
    try {
      setPreviewHistoryGroupIndex(null);
      setPreviewAnchorTop(null);
      await hideHistoryPreviewWindow();
      await showAboutWindow();
    } catch (error) {
      console.error("打开关于窗口失败:", error);
    }
  };

  const openPreferencesDialog = async () => {
    try {
      setPreviewHistoryGroupIndex(null);
      setPreviewAnchorTop(null);
      await hideHistoryPreviewWindow();
      await showPreferencesWindow();
    } catch (error) {
      console.error("打开偏好设置窗口失败:", error);
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
    setPreviewHistoryGroupIndex(groupIndex);
    setPreviewAnchorTop(anchorTop);
  };

  const closeHistoryGroupPreview = () => {
    clearScheduledPreviewClose();
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
    visibleHistory,
    historyGroups,
    hasHistory: history.length > 0,
    previewHistory,
    previewHistoryGroupIndex,
    searchQuery,
    selectedHistoryItem,
    settings,
    clearHistory: clearHistoryItems,
    closeHistoryGroupPreview,
    hideWindow,
    moveSelection,
    openAboutDialog,
    openPreferencesDialog,
    quit,
    openHistoryGroupPreview,
    selectHighlightedHistoryItem,
    selectHistoryItem,
    setSearchQuery,
    scheduleHistoryGroupPreviewClose,
  };
}
