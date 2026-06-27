import type { UnlistenFn } from "@tauri-apps/api/event";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_SETTINGS } from "../constants";
import { getHistory, getSettings } from "../services/ipc/commands";
import { listenToHistoryUpdated, listenToSettingsUpdated } from "../services/ipc/events";
import type {
  AppSettings,
  HistoryEntry,
  HistoryGroupInfo,
  HistoryListItem,
} from "../types";
import {
  filterHistoryItems,
  getHistoryGroupItems,
  getHistoryGroups,
} from "../utils/history";
import { getSearchQueryAfterHistorySelection } from "../utils/searchInteraction";
import { normalizeSettings } from "../utils/settings";

type UseClipboardDataControllerArgs = {
  onLikelyClipboardInsert: () => void;
};

type UseClipboardDataControllerResult = {
  clearLocalHistory: () => void;
  clearSearchQueryAfterHistorySelection: () => void;
  filteredHistory: HistoryListItem[];
  hasHistory: boolean;
  historyGroups: HistoryGroupInfo[];
  replaceHistory: (updatedHistory: HistoryEntry[]) => void;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  settings: AppSettings;
  visibleHistory: HistoryListItem[];
};

export function useClipboardDataController({
  onLikelyClipboardInsert,
}: UseClipboardDataControllerArgs): UseClipboardDataControllerResult {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const onLikelyClipboardInsertRef = useRef(onLikelyClipboardInsert);
  const searchQueryRef = useRef(searchQuery);

  const filteredHistory = useMemo(
    () => filterHistoryItems(history, searchQuery),
    [history, searchQuery],
  );
  const historyGroups = useMemo(
    () =>
      getHistoryGroups(
        filteredHistory.length,
        settings.mainWindowItemCount,
        settings.historyGroupItemCount,
      ),
    [
      filteredHistory.length,
      settings.historyGroupItemCount,
      settings.mainWindowItemCount,
    ],
  );
  const visibleHistory = useMemo(
    () =>
      historyGroups[0]
        ? getHistoryGroupItems(filteredHistory, historyGroups[0])
        : [],
    [filteredHistory, historyGroups],
  );

  function clearSearchQueryAfterHistorySelection() {
    const nextSearchQuery = getSearchQueryAfterHistorySelection(searchQueryRef.current);
    searchQueryRef.current = nextSearchQuery;
    setSearchQuery(nextSearchQuery);
  }

  function replaceHistory(updatedHistory: HistoryEntry[]) {
    setHistory(updatedHistory);
  }

  function clearLocalHistory() {
    setHistory([]);
  }

  useEffect(() => {
    onLikelyClipboardInsertRef.current = onLikelyClipboardInsert;
  }, [onLikelyClipboardInsert]);

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
                onLikelyClipboardInsertRef.current();
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

  return {
    clearLocalHistory,
    clearSearchQueryAfterHistorySelection,
    filteredHistory,
    hasHistory: history.length > 0,
    historyGroups,
    replaceHistory,
    searchQuery,
    setSearchQuery,
    settings,
    visibleHistory,
  };
}
