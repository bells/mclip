import type { Dispatch, SetStateAction } from "react";

import {
  clearHistory as clearHistoryCommand,
  copyHistoryItem,
  deleteHistoryItem as deleteHistoryItemCommand,
  pasteClipboard,
  quitApp,
  showAboutWindow,
  showPreferencesWindow,
} from "../services/ipc/commands";
import { hideCurrentWindow } from "../services/ipc/windows";
import type { AppSettings, HistoryEntry, HistoryListItem } from "../types";
import { shouldAutoPasteAfterHistorySelection } from "../utils/selectionBehavior";

type UseClipboardActionsArgs = {
  beginSelectionPreviewDismissal: () => void;
  clearLocalHistory: () => void;
  clearPreviewState: () => void;
  clearSearchQueryAfterHistorySelection: () => void;
  hidePreviewWindow: () => Promise<void>;
  replaceHistory: (updatedHistory: HistoryEntry[]) => void;
  resetSelectionPreviewDismissal: () => void;
  selectedHistoryIndex: number;
  setSelectedHistoryIndex: Dispatch<SetStateAction<number>>;
  settings: AppSettings;
  visibleHistory: HistoryListItem[];
};

type UseClipboardActionsResult = {
  clearHistory: () => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  hideWindow: () => Promise<void>;
  openAboutDialog: () => Promise<void>;
  openPreferencesDialog: () => Promise<void>;
  quit: () => Promise<void>;
  selectHighlightedHistoryItem: () => Promise<void>;
  selectHistoryItem: (id: string) => Promise<void>;
};

export function useClipboardActions({
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
}: UseClipboardActionsArgs): UseClipboardActionsResult {
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

  const clearHistory = async () => {
    try {
      await clearHistoryCommand();
      clearLocalHistory();
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
      replaceHistory(updatedHistory);
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

  const selectHighlightedHistoryItem = async () => {
    if (selectedHistoryIndex < 0) {
      return;
    }

    const selectedItem = visibleHistory[selectedHistoryIndex];

    if (selectedItem) {
      await selectHistoryItem(selectedItem.id);
    }
  };

  return {
    clearHistory,
    deleteHistoryItem,
    hideWindow,
    openAboutDialog,
    openPreferencesDialog,
    quit,
    selectHighlightedHistoryItem,
    selectHistoryItem,
  };
}
