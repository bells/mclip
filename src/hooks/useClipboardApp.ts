// 主窗口状态中心：加载设置/历史、处理快捷键选择、驱动窗口高度和 preview 窗口联动。

import type { UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_SETTINGS,
  GROUP_PREVIEW_WIDTH,
  GROUP_PREVIEW_WITH_DETAIL_WIDTH,
  HISTORY_GROUP_SIZE,
  ITEM_PREVIEW_WIDTH,
} from "../constants";
import {
  adjustWindowHeight,
  clearHistory,
  copyHistoryItem,
  deleteHistoryItem as deleteHistoryItemCommand,
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
import type { AppSettings, HistoryEntry, HistoryListItem } from "../types";
import {
  filterHistoryItems,
  getHistoryGroupItems,
  getHistoryGroups,
} from "../utils/history";
import {
  getGroupPreviewHeight,
  getItemPreviewAnchorTop,
  getItemPreviewHeight,
} from "../utils/preview";
import { normalizeSettings } from "../utils/settings";

const PREVIEW_CLOSE_DELAY_MS = 500;

export function useClipboardApp() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [previewHistoryGroupIndex, setPreviewHistoryGroupIndex] = useState<number | null>(null);
  const [previewHistoryItemId, setPreviewHistoryItemId] = useState<string | null>(null);
  const [previewAnchorTop, setPreviewAnchorTop] = useState<number | null>(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
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
  const previewHistoryItem = useMemo(
    () =>
      previewHistoryItemId === null
        ? null
        : filteredHistory.find((item) => item.id === previewHistoryItemId) ?? null,
    [filteredHistory, previewHistoryItemId],
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
            setHistory((currentHistory) => {
              const isLikelyClipboardInsert =
                updatedHistory.length >= currentHistory.length &&
                updatedHistory[0]?.id !== currentHistory[0]?.id;

              if (
                isLikelyClipboardInsert &&
                searchQueryRef.current.trim() === ""
              ) {
                // 无搜索时新剪贴板内容进来，列表回到顶部并关闭旧 preview。
                setPreviewHistoryGroupIndex(null);
                setPreviewHistoryItemId(null);
                setPreviewAnchorTop(null);
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
      void isPointerOverHistoryPreviewWindow()
        .then((isPointerOverPreview) => {
          if (isPointerOverPreview) {
            scheduleHistoryGroupPreviewClose();
            return;
          }

          closeHistoryGroupPreview();
        })
        .catch((error) => {
          console.error("检测历史预览鼠标位置失败:", error);
          closeHistoryGroupPreview();
        });
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
    setPreviewHistoryItemId(null);
    setPreviewAnchorTop(null);
    setSelectedHistoryIndex(-1);
  }, [searchQuery]);

  useEffect(() => {
    if (previewHistoryItemId !== null && !previewHistoryItem) {
      setPreviewHistoryItemId(null);
      setPreviewAnchorTop(null);
    }
  }, [previewHistoryItem, previewHistoryItemId]);

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
    if (previewAnchorTop !== null && previewHistoryItem) {
      void updateHistoryPreviewWindow({
        item: previewHistoryItem,
        kind: "item",
        language: settings.language,
      })
        .then(() =>
          showHistoryPreviewWindow(
            getItemPreviewAnchorTop(previewAnchorTop),
            getItemPreviewHeight(previewHistoryItem),
            ITEM_PREVIEW_WIDTH,
            ITEM_PREVIEW_WIDTH,
          ),
        )
        .catch((error) => {
          console.error("显示历史条目预览失败:", error);
        });
      return;
    }

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
      kind: "group",
      language: settings.language,
    })
      .then(() =>
        showHistoryPreviewWindow(
          previewAnchorTop,
          getGroupPreviewHeight(previewHistory.length),
          GROUP_PREVIEW_WIDTH,
          GROUP_PREVIEW_WITH_DETAIL_WIDTH,
        ),
      )
      .catch((error) => {
        console.error("显示历史分组预览失败:", error);
      });
  }, [
    historyGroups,
    previewAnchorTop,
    previewHistory,
    previewHistoryItem,
    previewHistoryGroupIndex,
    settings.language,
  ]);

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
      setPreviewHistoryGroupIndex(null);
      setPreviewHistoryItemId(null);
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
      setPreviewHistoryItemId(null);
      setPreviewAnchorTop(null);
      await hideHistoryPreviewWindow();
      await showPreferencesWindow();
    } catch (error) {
      console.error("打开偏好设置窗口失败:", error);
    }
  };

  const selectHistoryItem = async (id: string) => {
    try {
      setPreviewHistoryGroupIndex(null);
      setPreviewHistoryItemId(null);
      setPreviewAnchorTop(null);
      await hideHistoryPreviewWindow();
      await copyHistoryItem(id);
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
      setPreviewHistoryItemId(null);
      setPreviewAnchorTop(null);
      setSelectedHistoryIndex(-1);
    } catch (error) {
      console.error("清空历史失败:", error);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      setPreviewHistoryGroupIndex(null);
      setPreviewHistoryItemId(null);
      setPreviewAnchorTop(null);
      await hideHistoryPreviewWindow();

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
      setPreviewHistoryGroupIndex(null);
      setPreviewHistoryItemId(null);
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

  const clearScheduledPreviewClose = () => {
    if (previewCloseTimerRef.current !== null) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
  };

  const openHistoryGroupPreview = (groupIndex: number, anchorTop: number) => {
    clearScheduledPreviewClose();
    setPreviewHistoryGroupIndex(groupIndex);
    setPreviewHistoryItemId(null);
    setPreviewAnchorTop(anchorTop);
  };

  const openHistoryItemPreview = (item: HistoryListItem, anchorTop: number) => {
    clearScheduledPreviewClose();
    setPreviewHistoryGroupIndex(null);
    setPreviewHistoryItemId(item.id);
    setPreviewAnchorTop(anchorTop);
  };

  const closeHistoryGroupPreview = () => {
    clearScheduledPreviewClose();
    setPreviewHistoryGroupIndex(null);
    setPreviewHistoryItemId(null);
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

  const selectedHistoryItem: HistoryListItem | undefined =
    selectedHistoryIndex >= 0 ? visibleHistory[selectedHistoryIndex] : undefined;

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
