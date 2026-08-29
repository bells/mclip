import type { UnlistenFn } from "@tauri-apps/api/event";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_SETTINGS } from "../constants";
import { getHistorySnapshot, getSettings } from "../services/ipc/commands";
import {
  listenToHistoryChanged,
  listenToSensitiveHistoryRevealFailed,
  listenToSettingsUpdated,
} from "../services/ipc/events";
import type {
  AppSettings,
  HistoryChange,
  HistoryGroupInfo,
  HistoryListItem,
  HistorySnapshot,
  SensitiveHistoryRevealErrorCode,
} from "../types";
import {
  filterHistoryItems,
  getVisibleHistoryItems,
  getHistoryGroups,
  splitPinnedHistoryItems,
} from "../utils/history";
import { getSearchQueryAfterHistorySelection } from "../utils/searchInteraction";
import { normalizeSettings } from "../utils/settings";
import { recordFrontendPerformanceAfterPaint } from "../services/performance";
import { applyHistoryChange as reduceHistoryChange } from "../utils/historyChanges";
import { maskSensitiveHistoryItems } from "../utils/sensitiveContent";

type UseClipboardDataControllerArgs = {
  onLikelyClipboardInsert: () => void;
};

type UseClipboardDataControllerResult = {
  applyHistoryChange: (change: HistoryChange | null) => void;
  clearSearchQueryAfterHistorySelection: () => void;
  filteredHistory: HistoryListItem[];
  hasHistory: boolean;
  historyGroups: HistoryGroupInfo[];
  historyRevision: number;
  pinnedHistoryCount: number;
  searchQuery: string;
  sensitiveRevealNotice: SensitiveHistoryRevealErrorCode | null;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  settings: AppSettings;
  visibleHistory: HistoryListItem[];
};

export function useClipboardDataController({
  onLikelyClipboardInsert,
}: UseClipboardDataControllerArgs): UseClipboardDataControllerResult {
  const [historySnapshot, setHistorySnapshot] = useState<HistorySnapshot>({
    entries: [],
    revision: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sensitiveRevealNotice, setSensitiveRevealNotice] =
    useState<SensitiveHistoryRevealErrorCode | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const historySnapshotRef = useRef(historySnapshot);
  const historyInitializedRef = useRef(false);
  const historyRefreshPromiseRef = useRef<Promise<void> | null>(null);
  const isMountedRef = useRef(true);
  const onLikelyClipboardInsertRef = useRef(onLikelyClipboardInsert);
  const pendingHistoryChangesRef = useRef<HistoryChange[]>([]);
  const searchQueryRef = useRef(searchQuery);
  const sensitiveRevealNoticeTimerRef = useRef<number | null>(null);
  const history = historySnapshot.entries;

  const unmaskedFilteredHistory = useMemo(
    () => filterHistoryItems(history, searchQuery),
    [history, searchQuery],
  );
  const filteredHistory = useMemo(
    () =>
      maskSensitiveHistoryItems(
        unmaskedFilteredHistory,
        settings.maskSensitiveContent,
      ),
    [unmaskedFilteredHistory, settings.maskSensitiveContent],
  );
  const historyGroups = useMemo(
    () => {
      const { unpinned } = splitPinnedHistoryItems(filteredHistory);
      return getHistoryGroups(
        unpinned.length,
        settings.mainWindowItemCount,
        settings.historyGroupItemCount,
      );
    },
    [
      filteredHistory.length,
      settings.historyGroupItemCount,
      settings.mainWindowItemCount,
    ],
  );
  const visibleHistory = useMemo(
    () => getVisibleHistoryItems(filteredHistory, settings.mainWindowItemCount),
    [filteredHistory, settings.mainWindowItemCount],
  );

  function clearSearchQueryAfterHistorySelection() {
    const nextSearchQuery = getSearchQueryAfterHistorySelection(searchQueryRef.current);
    searchQueryRef.current = nextSearchQuery;
    setSearchQuery(nextSearchQuery);
  }

  function commitHistorySnapshot(nextSnapshot: HistorySnapshot) {
    historySnapshotRef.current = nextSnapshot;
    setHistorySnapshot(nextSnapshot);
  }

  function refreshHistorySnapshot() {
    if (historyRefreshPromiseRef.current) {
      return historyRefreshPromiseRef.current;
    }

    const refreshPromise = getHistorySnapshot()
      .then((nextSnapshot) => {
        if (
          isMountedRef.current &&
          nextSnapshot.revision >= historySnapshotRef.current.revision
        ) {
          commitHistorySnapshot(nextSnapshot);
        }
      })
      .catch((error) => {
        console.error("恢复剪贴板历史快照失败:", error);
      })
      .finally(() => {
        if (historyRefreshPromiseRef.current === refreshPromise) {
          historyRefreshPromiseRef.current = null;
        }
      });

    historyRefreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }

  function applyHistoryChange(change: HistoryChange | null) {
    if (!change) {
      return;
    }

    if (!historyInitializedRef.current) {
      pendingHistoryChangesRef.current.push(change);
      return;
    }

    const result = reduceHistoryChange(historySnapshotRef.current, change);
    if (result.status === "needsReplace") {
      void refreshHistorySnapshot();
      return;
    }

    if (result.status === "applied") {
      commitHistorySnapshot(result.snapshot);
      if (change.kind === "upsert") {
        onLikelyClipboardInsertRef.current();
      }
    }
  }

  useEffect(() => {
    onLikelyClipboardInsertRef.current = onLikelyClipboardInsert;
  }, [onLikelyClipboardInsert]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    isMountedRef.current = true;
    let isActive = true;
    let unlisten: UnlistenFn | undefined;

    const initializeApp = async () => {
      try {
        const loadedSettingsPromise = getSettings();
        unlisten = await listenToHistoryChanged((change) => {
          if (isActive) {
            applyHistoryChange(change);
          }
        });
        const [loadedSettings, initialSnapshot] = await Promise.all([
          loadedSettingsPromise,
          getHistorySnapshot(),
        ]);

        if (!isActive) {
          return;
        }

        const normalizedSettings = normalizeSettings(loadedSettings);
        setSettings(normalizedSettings);
        commitHistorySnapshot(initialSnapshot);
        historyInitializedRef.current = true;

        const pendingChanges = pendingHistoryChangesRef.current
          .splice(0)
          .sort((left, right) => left.revision - right.revision);
        for (const change of pendingChanges) {
          applyHistoryChange(change);
        }

        recordFrontendPerformanceAfterPaint("historyReady", {
          fixtureSize: historySnapshotRef.current.entries.length,
          windowLabel: "main",
        });
      } catch (error) {
        console.error("初始化应用失败:", error);
      }
    };

    void initializeApp();

    return () => {
      isActive = false;
      isMountedRef.current = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    void listenToSensitiveHistoryRevealFailed(({ code }) => {
      setSensitiveRevealNotice(code);
      if (code === "itemNotFound" || code === "classificationStale") {
        void refreshHistorySnapshot();
      }

      if (sensitiveRevealNoticeTimerRef.current !== null) {
        window.clearTimeout(sensitiveRevealNoticeTimerRef.current);
      }
      sensitiveRevealNoticeTimerRef.current = window.setTimeout(() => {
        sensitiveRevealNoticeTimerRef.current = null;
        setSensitiveRevealNotice(null);
      }, 4_000);
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
      if (sensitiveRevealNoticeTimerRef.current !== null) {
        window.clearTimeout(sensitiveRevealNoticeTimerRef.current);
        sensitiveRevealNoticeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    void listenToSettingsUpdated((updatedSettings) => {
      setSettings(normalizeSettings(updatedSettings));
      void refreshHistorySnapshot();
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  return {
    applyHistoryChange,
    clearSearchQueryAfterHistorySelection,
    filteredHistory,
    hasHistory: history.length > 0,
    historyGroups,
    historyRevision: historySnapshot.revision,
    pinnedHistoryCount: history.filter((item) => item.isPinned).length,
    searchQuery,
    sensitiveRevealNotice,
    setSearchQuery,
    settings,
    visibleHistory,
  };
}
