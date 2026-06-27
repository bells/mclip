import type { UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  GROUP_PREVIEW_WIDTH,
  GROUP_PREVIEW_WITH_DETAIL_WIDTH,
  ITEM_PREVIEW_WIDTH,
} from "../constants";
import {
  hideHistoryPreviewWindow,
  isPointerOverHistoryPreviewWindow,
  showHistoryPreviewWindow,
  type PreviewWindowSide,
} from "../services/ipc/commands";
import {
  listenToHistoryPreviewCloseRequested,
  listenToHistoryPreviewPointerEntered,
  listenToHistoryPreviewSelectionCancelled,
  listenToHistoryPreviewSelectionStarted,
  listenToMainWindowShown,
  updateHistoryPreviewWindow,
} from "../services/ipc/events";
import type { AppSettings, HistoryGroupInfo, HistoryListItem } from "../types";
import { getHistoryGroupItems } from "../utils/history";
import {
  getGroupPreviewHeight,
  getItemPreviewAnchorTop,
  getItemPreviewHeight,
} from "../utils/preview";
import {
  beginPreviewOpenRequest,
  cancelPreviewOpenRequests,
  canCompletePreviewOpenRequest,
  canStartPreviewOpenRequest,
  createPreviewDismissalState,
  dismissPreviewForSelection,
  resetPreviewSelectionDismissal,
} from "../utils/previewDismissal";

const PREVIEW_CLOSE_DELAY_MS = 500;

type UseHistoryPreviewControllerArgs = {
  filteredHistory: HistoryListItem[];
  historyGroups: HistoryGroupInfo[];
  onMainWindowShown: () => void;
  settings: AppSettings;
};

type UseHistoryPreviewControllerResult = {
  beginSelectionPreviewDismissal: () => void;
  clearPreviewState: () => void;
  closeHistoryGroupPreview: () => void;
  hidePreviewWindow: () => Promise<void>;
  openHistoryGroupPreview: (groupIndex: number, anchorTop: number) => void;
  openHistoryItemPreview: (item: HistoryListItem, anchorTop: number) => void;
  previewHistory: HistoryListItem[];
  previewHistoryGroupIndex: number | null;
  previewWindowSide: PreviewWindowSide | null;
  resetSelectionPreviewDismissal: () => void;
  scheduleHistoryGroupPreviewClose: () => void;
};

export function useHistoryPreviewController({
  filteredHistory,
  historyGroups,
  onMainWindowShown,
  settings,
}: UseHistoryPreviewControllerArgs): UseHistoryPreviewControllerResult {
  const [previewHistoryGroupIndex, setPreviewHistoryGroupIndex] =
    useState<number | null>(null);
  const [previewHistoryItemId, setPreviewHistoryItemId] = useState<string | null>(null);
  const [previewAnchorTop, setPreviewAnchorTop] = useState<number | null>(null);
  const [previewWindowSide, setPreviewWindowSide] =
    useState<PreviewWindowSide | null>(null);
  const previewCloseTimerRef = useRef<number | null>(null);
  const previewDismissalStateRef = useRef(createPreviewDismissalState());
  const onMainWindowShownRef = useRef(onMainWindowShown);

  const previewHistory = useMemo(
    () => {
      if (previewHistoryGroupIndex === null) {
        return [];
      }

      const previewGroup = historyGroups.find(
        (group) => group.index === previewHistoryGroupIndex,
      );

      return previewGroup
        ? getHistoryGroupItems(filteredHistory, previewGroup)
        : [];
    },
    [filteredHistory, historyGroups, previewHistoryGroupIndex],
  );
  const previewHistoryItem = useMemo(
    () =>
      previewHistoryItemId === null
        ? null
        : filteredHistory.find((item) => item.id === previewHistoryItemId) ?? null,
    [filteredHistory, previewHistoryItemId],
  );

  function clearScheduledPreviewClose() {
    if (previewCloseTimerRef.current !== null) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
  }

  function cancelPendingPreviewOpenRequests() {
    previewDismissalStateRef.current = cancelPreviewOpenRequests(
      previewDismissalStateRef.current,
    );
  }

  function clearPreviewState() {
    cancelPendingPreviewOpenRequests();
    clearScheduledPreviewClose();
    setPreviewHistoryGroupIndex(null);
    setPreviewHistoryItemId(null);
    setPreviewAnchorTop(null);
    setPreviewWindowSide(null);
  }

  function beginSelectionPreviewDismissal() {
    previewDismissalStateRef.current = dismissPreviewForSelection(
      previewDismissalStateRef.current,
    );
    clearScheduledPreviewClose();
    setPreviewHistoryGroupIndex(null);
    setPreviewHistoryItemId(null);
    setPreviewAnchorTop(null);
    setPreviewWindowSide(null);
  }

  function resetSelectionPreviewDismissal() {
    previewDismissalStateRef.current = resetPreviewSelectionDismissal(
      previewDismissalStateRef.current,
    );
  }

  function openHistoryGroupPreview(groupIndex: number, anchorTop: number) {
    if (!canStartPreviewOpenRequest(previewDismissalStateRef.current)) {
      return;
    }

    clearScheduledPreviewClose();
    setPreviewHistoryGroupIndex(groupIndex);
    setPreviewHistoryItemId(null);
    setPreviewAnchorTop(anchorTop);
  }

  function openHistoryItemPreview(item: HistoryListItem, anchorTop: number) {
    if (!canStartPreviewOpenRequest(previewDismissalStateRef.current)) {
      return;
    }

    clearScheduledPreviewClose();
    setPreviewHistoryGroupIndex(null);
    setPreviewHistoryItemId(item.id);
    setPreviewAnchorTop(anchorTop);
  }

  function closeHistoryGroupPreview() {
    clearPreviewState();
  }

  function scheduleHistoryGroupPreviewClose() {
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
  }

  useEffect(() => {
    onMainWindowShownRef.current = onMainWindowShown;
  }, [onMainWindowShown]);

  useEffect(() => {
    let unlistenCloseRequested: UnlistenFn | undefined;
    let unlistenPointerEntered: UnlistenFn | undefined;
    let unlistenSelectionStarted: UnlistenFn | undefined;
    let unlistenSelectionCancelled: UnlistenFn | undefined;
    let unlistenMainWindowShown: UnlistenFn | undefined;

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

    void listenToHistoryPreviewSelectionStarted(() => {
      beginSelectionPreviewDismissal();
      void hideHistoryPreviewWindow().catch((error) => {
        console.error("隐藏历史预览失败:", error);
      });
    }).then((unsubscribe) => {
      unlistenSelectionStarted = unsubscribe;
    });

    void listenToHistoryPreviewSelectionCancelled(() => {
      resetSelectionPreviewDismissal();
    }).then((unsubscribe) => {
      unlistenSelectionCancelled = unsubscribe;
    });

    void listenToMainWindowShown(() => {
      resetSelectionPreviewDismissal();
      clearPreviewState();
      onMainWindowShownRef.current();
    }).then((unsubscribe) => {
      unlistenMainWindowShown = unsubscribe;
    });

    return () => {
      unlistenCloseRequested?.();
      unlistenPointerEntered?.();
      unlistenSelectionStarted?.();
      unlistenSelectionCancelled?.();
      unlistenMainWindowShown?.();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearScheduledPreviewClose();
    };
  }, []);

  useEffect(() => {
    if (previewHistoryItemId !== null && !previewHistoryItem) {
      clearPreviewState();
    }
  }, [previewHistoryItem, previewHistoryItemId]);

  useEffect(() => {
    if (
      previewHistoryGroupIndex !== null &&
      previewHistoryGroupIndex >= historyGroups.length
    ) {
      clearPreviewState();
    }
  }, [historyGroups.length, previewHistoryGroupIndex]);

  useEffect(() => {
    if (previewAnchorTop !== null && previewHistoryItem) {
      if (!canStartPreviewOpenRequest(previewDismissalStateRef.current)) {
        return;
      }

      const request = beginPreviewOpenRequest(previewDismissalStateRef.current);

      void updateHistoryPreviewWindow({
        autoPaste: settings.autoPaste,
        appearanceTheme: settings.appearanceTheme,
        item: previewHistoryItem,
        kind: "item",
        language: settings.language,
      })
        .then(async () => {
          if (!canCompletePreviewOpenRequest(previewDismissalStateRef.current, request)) {
            return;
          }

          const placement = await showHistoryPreviewWindow(
            getItemPreviewAnchorTop(previewAnchorTop),
            getItemPreviewHeight(previewHistoryItem),
            ITEM_PREVIEW_WIDTH,
            ITEM_PREVIEW_WIDTH,
          );

          if (!canCompletePreviewOpenRequest(previewDismissalStateRef.current, request)) {
            await hideHistoryPreviewWindow();
            return;
          }

          setPreviewWindowSide(placement.side);
        })
        .catch((error) => {
          console.error("显示历史条目预览失败:", error);
        });
      return;
    }

    const previewGroup = historyGroups.find(
      (group) => group.index === previewHistoryGroupIndex,
    );

    if (previewAnchorTop === null || !previewGroup || previewHistory.length === 0) {
      cancelPendingPreviewOpenRequests();
      void hideHistoryPreviewWindow().catch((error) => {
        console.error("隐藏历史分组预览失败:", error);
      });
      return;
    }

    if (!canStartPreviewOpenRequest(previewDismissalStateRef.current)) {
      return;
    }

    const request = beginPreviewOpenRequest(previewDismissalStateRef.current);

    void updateHistoryPreviewWindow({
      autoPaste: settings.autoPaste,
      appearanceTheme: settings.appearanceTheme,
      group: previewGroup,
      items: previewHistory,
      kind: "group",
      language: settings.language,
      showHistoryItemNumbers: settings.showHistoryItemNumbers,
    })
      .then(async () => {
        if (!canCompletePreviewOpenRequest(previewDismissalStateRef.current, request)) {
          return;
        }

        const placement = await showHistoryPreviewWindow(
          previewAnchorTop,
          getGroupPreviewHeight(previewHistory.length),
          GROUP_PREVIEW_WIDTH,
          GROUP_PREVIEW_WITH_DETAIL_WIDTH,
        );

        if (!canCompletePreviewOpenRequest(previewDismissalStateRef.current, request)) {
          await hideHistoryPreviewWindow();
          return;
        }

        setPreviewWindowSide(placement.side);
      })
      .catch((error) => {
        console.error("显示历史分组预览失败:", error);
      });
  }, [
    historyGroups,
    previewAnchorTop,
    previewHistory,
    previewHistoryItem,
    previewHistoryGroupIndex,
    settings.appearanceTheme,
    settings.autoPaste,
    settings.language,
    settings.showHistoryItemNumbers,
  ]);

  return {
    beginSelectionPreviewDismissal,
    clearPreviewState,
    closeHistoryGroupPreview,
    hidePreviewWindow: hideHistoryPreviewWindow,
    openHistoryGroupPreview,
    openHistoryItemPreview,
    previewHistory,
    previewHistoryGroupIndex,
    previewWindowSide,
    resetSelectionPreviewDismissal,
    scheduleHistoryGroupPreviewClose,
  };
}
