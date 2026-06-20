// 主窗口状态中心：组合数据、preview、选择和应用级动作。

import { useEffect, useRef, useState } from "react";

import { adjustWindowHeight } from "../services/ipc/commands";
import type { HistoryListItem } from "../types";
import { useClipboardActions } from "./useClipboardActions";
import { useClipboardDataController } from "./useClipboardDataController";
import { useHistoryPreviewController } from "./useHistoryPreviewController";

export function useClipboardApp() {
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const clearPreviewStateRef = useRef<() => void>(() => undefined);
  const {
    clearLocalHistory,
    clearSearchQueryAfterHistorySelection,
    filteredHistory,
    hasHistory,
    historyGroups,
    replaceHistory,
    searchQuery,
    setSearchQuery,
    settings,
    visibleHistory,
  } = useClipboardDataController({
    onLikelyClipboardInsert: () => {
      clearPreviewStateRef.current();
      setSelectedHistoryIndex(-1);
    },
  });
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
  clearPreviewStateRef.current = clearPreviewState;
  const {
    clearHistory: clearHistoryItems,
    deleteHistoryItem,
    hideWindow,
    openAboutDialog,
    openPreferencesDialog,
    quit,
    selectHighlightedHistoryItem,
    selectHistoryItem,
  } = useClipboardActions({
    beginSelectionPreviewDismissal,
    clearLocalHistory,
    clearPreviewState,
    clearSearchQueryAfterHistorySelection,
    hidePreviewWindow,
    replaceHistory,
    resetSelectionPreviewDismissal,
    selectedHistoryIndex,
    setSelectedHistoryIndex,
    settings,
    visibleHistory,
  });

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

  const selectedHistoryItem: HistoryListItem | undefined =
    selectedHistoryIndex >= 0 ? visibleHistory[selectedHistoryIndex] : undefined;

  return {
    visibleHistory,
    historyGroups,
    hasHistory,
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
