// 独立 preview 窗口容器：监听主窗口推送的数据，再分发给详情页或分组页。

import { useEffect, useRef, useState } from "react";

import { GROUP_PREVIEW_DETAIL_WINDOW_WIDTH } from "../constants";
import { useApplyAppTheme } from "../hooks/useApplyAppTheme";
import { getTranslations } from "../i18n";
import {
  copyHistoryItem,
  deleteHistoryItem,
  hideHistoryPreviewDetailWindow,
  hideHistoryPreviewWindow,
  hideMainWindow,
  listenToHistoryPreviewInvalidated,
  listenToHistoryPreviewKeyboardNavigation,
  listenToHistoryPreviewUpdated,
  listenToPerformanceAutomation,
  notifyHistoryPreviewGroupItemActivated,
  notifyHistoryPreviewPointerEntered,
  notifyHistoryPreviewPlacementUpdated,
  notifyHistoryPreviewSelectionCancelled,
  notifyHistoryPreviewSelectionStarted,
  pasteClipboard,
  toggleHistoryItemPinned,
  openImageViewer,
  requestHistoryPreviewClose,
  showHistoryPreviewDetailWindow,
  updateHistoryPreviewDetailWindow,
} from "../lib/tauri";
import type { HistoryPreviewPayload } from "../types";
import { getNextGroupPreviewItemIndex } from "../utils/keyboardNavigation";
import { getItemPreviewAnchorTop, getItemPreviewHeight } from "../utils/preview";
import { shouldAutoPasteAfterHistoryPreviewSelection } from "../utils/selectionBehavior";
import { reconcilePreviewWithInvalidation } from "../utils/previewHistory";
import {
  createPerformanceInteractionId,
  recordFrontendPerformanceAfterPaint,
} from "../services/performance";
import {
  ensureAuxiliaryWindowReady,
  reportAuxiliaryListenerReady,
} from "../services/auxiliaryWindows";
import { HistoryGroupPreviewWindow } from "./HistoryGroupPreviewWindow";
import { HistoryItemPreviewWindow } from "./HistoryItemPreviewWindow";

function getGroupPreviewItemAnchorTop(itemId: string) {
  const itemElements = document.querySelectorAll<HTMLElement>(
    "[data-preview-item-id]",
  );
  const activeItemElement = Array.from(itemElements).find(
    (element) => element.dataset.previewItemId === itemId,
  );

  if (!activeItemElement) {
    return null;
  }

  return getItemPreviewAnchorTop(
    activeItemElement.getBoundingClientRect().top,
  );
}

export function HistoryPreviewWindow() {
  // preview 为 null 时窗口没有可展示数据，组件会返回 null。
  const [preview, setPreview] = useState<HistoryPreviewPayload | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);
  // ref 适合保存不参与渲染的可变值；这里记录上次通知主窗口的时间。
  const lastPointerNotifyAtRef = useRef(0);
  const previewRef = useRef<HistoryPreviewPayload | null>(null);
  const hoveredItemIdRef = useRef<string | null>(null);
  const isKeyboardNavigatingRef = useRef(false);
  const pendingKeyboardActivationGroupIndexRef = useRef<number | null>(null);
  const detailUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
  useApplyAppTheme(preview?.appearanceTheme ?? "system");

  function setPreviewKeyboardNavigating(nextValue: boolean) {
    isKeyboardNavigatingRef.current = nextValue;
    setIsKeyboardNavigating(nextValue);
  }

  function setActiveGroupPreviewItemId(
    id: string | null,
    source: "keyboard" | "pointer" = "keyboard",
  ) {
    if (source === "pointer" && isKeyboardNavigatingRef.current) {
      return;
    }

    hoveredItemIdRef.current = id;
    setHoveredItemId(id);

    const currentPreview = previewRef.current;
    if (source === "pointer" && id && currentPreview?.kind === "group") {
      void notifyHistoryPreviewGroupItemActivated({
        groupIndex: currentPreview.group.index,
      });
    }
  }

  function getKeyboardGroupPreview(groupIndex: number) {
    const currentPreview = previewRef.current;

    if (
      currentPreview?.kind !== "group" ||
      currentPreview.group.index !== groupIndex
    ) {
      return null;
    }

    return currentPreview;
  }

  function activateFirstKeyboardGroupPreviewItem(groupIndex: number) {
    const currentPreview = getKeyboardGroupPreview(groupIndex);

    if (!currentPreview) {
      pendingKeyboardActivationGroupIndexRef.current = groupIndex;
      return;
    }

    pendingKeyboardActivationGroupIndexRef.current = null;
    setActiveGroupPreviewItemId(currentPreview.items[0]?.id ?? null);
  }

  function moveKeyboardGroupPreviewItem(groupIndex: number, offset: -1 | 1) {
    const currentPreview = getKeyboardGroupPreview(groupIndex);

    if (!currentPreview) {
      return;
    }

    const currentIndex = currentPreview.items.findIndex(
      (item) => item.id === hoveredItemIdRef.current,
    );
    const nextIndex = getNextGroupPreviewItemIndex(
      currentIndex < 0 ? null : currentIndex,
      offset,
      currentPreview.items.length,
    );

    setActiveGroupPreviewItemId(
      nextIndex === null ? null : currentPreview.items[nextIndex]?.id ?? null,
    );
  }

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | undefined;

    // preview 窗口不主动读取历史，由主窗口通过事件推送当前分组数据。
    void listenToHistoryPreviewUpdated((payload) => {
      const shouldActivatePendingKeyboardItem =
        payload.kind === "group" &&
        pendingKeyboardActivationGroupIndexRef.current === payload.group.index;

      const previousPreview = previewRef.current;
      const activeItemId = hoveredItemIdRef.current;
      const shouldPreserveActiveItem =
        payload.kind === "group" &&
        previousPreview?.kind === "group" &&
        previousPreview.group.index === payload.group.index &&
        activeItemId !== null &&
        payload.items.some((item) => item.id === activeItemId);

      previewRef.current = payload;
      setPreview(payload);
      setPreviewKeyboardNavigating(
        shouldActivatePendingKeyboardItem ||
          (shouldPreserveActiveItem && isKeyboardNavigatingRef.current),
      );

      if (shouldActivatePendingKeyboardItem) {
        pendingKeyboardActivationGroupIndexRef.current = null;
        setActiveGroupPreviewItemId(payload.items[0]?.id ?? null);
      } else if (!shouldPreserveActiveItem) {
        setActiveGroupPreviewItemId(null);
        void hideHistoryPreviewDetailWindow();
      }
    }).then((unsubscribe) => {
      if (isActive) {
        unlisten = unsubscribe;
        reportAuxiliaryListenerReady("historyPreviewUpdated");
        return;
      }

      unsubscribe();
    });

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | undefined;

    void listenToPerformanceAutomation((action) => {
      if (action !== "openViewer") {
        return;
      }

      const currentPreview = previewRef.current;
      if (currentPreview?.kind !== "item" || currentPreview.item.kind !== "image") {
        return;
      }

      void openImageViewer({
        appearanceTheme: currentPreview.appearanceTheme,
        item: currentPreview.item,
        language: currentPreview.language,
      }).catch((error) => {
        console.error("性能测试打开图片查看器失败:", error);
      });
    }).then((unsubscribe) => {
      if (isActive) {
        unlisten = unsubscribe;
        reportAuxiliaryListenerReady("performanceAutomation");
        return;
      }

      unsubscribe();
    });

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | undefined;

    void listenToHistoryPreviewInvalidated((invalidation) => {
      const currentPreview = previewRef.current;

      if (!currentPreview) {
        return;
      }

      const reconciliation = reconcilePreviewWithInvalidation(
        currentPreview,
        hoveredItemIdRef.current,
        invalidation,
      );

      if (reconciliation.shouldClearActiveItem) {
        setActiveGroupPreviewItemId(null);
        void hideHistoryPreviewDetailWindow();
      }

      if (!reconciliation.preview) {
        previewRef.current = null;
        setPreview(null);
        void hideHistoryPreviewWindow();
        return;
      }

      previewRef.current = reconciliation.preview;
      setPreview(reconciliation.preview);
    }).then((unsubscribe) => {
      if (isActive) {
        unlisten = unsubscribe;
        reportAuxiliaryListenerReady("historyPreviewInvalidated");
        return;
      }

      unsubscribe();
    });

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    previewRef.current = preview;

    if (preview) {
      recordFrontendPerformanceAfterPaint("previewPainted", {
        interactionId: preview.performanceInteractionId,
        windowLabel: "preview",
      });
    }
  }, [preview]);

  useEffect(() => {
    hoveredItemIdRef.current = hoveredItemId;
  }, [hoveredItemId]);

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | undefined;

    void listenToHistoryPreviewKeyboardNavigation((payload) => {
      setPreviewKeyboardNavigating(true);

      switch (payload.kind) {
        case "activate-first-group-item":
          activateFirstKeyboardGroupPreviewItem(payload.groupIndex);
          break;
        case "move-group-item":
          moveKeyboardGroupPreviewItem(payload.groupIndex, payload.offset);
          break;
        case "clear-group-item":
          pendingKeyboardActivationGroupIndexRef.current = null;
          if (getKeyboardGroupPreview(payload.groupIndex)) {
            setActiveGroupPreviewItemId(null);
          }
          break;
        case "select-group-item": {
          const currentPreview = getKeyboardGroupPreview(payload.groupIndex);
          const activeItemId = hoveredItemIdRef.current;

          if (
            currentPreview &&
            activeItemId &&
            currentPreview.items.some((item) => item.id === activeItemId)
          ) {
            void selectPreviewItem(activeItemId);
          }
          break;
        }
      }
    }).then((unsubscribe) => {
      if (isActive) {
        unlisten = unsubscribe;
        reportAuxiliaryListenerReady("keyboardNavigation");
        return;
      }

      unsubscribe();
    });

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, []);

  const selectPreviewItem = async (id: string) => {
    try {
      const shouldAutoPaste = shouldAutoPasteAfterHistoryPreviewSelection(
        previewRef.current,
      );

      await notifyHistoryPreviewSelectionStarted();
      await hideHistoryPreviewWindow();
      await copyHistoryItem(id);
      await hideMainWindow();

      if (shouldAutoPaste) {
        await pasteClipboard();
      }
    } catch (error) {
      void notifyHistoryPreviewSelectionCancelled().catch((notifyError) => {
        console.error("恢复历史预览选择状态失败:", notifyError);
      });
      console.error("复制历史分组记录失败:", error);
    }
  };

  const deletePreviewItem = async (id: string) => {
    try {
      await deleteHistoryItem(id);
    } catch (error) {
      console.error("删除历史分组记录失败:", error);
    }
  };

  const notifyPointerInside = () => {
    const now = Date.now();

    // Mousemove is chatty; throttle the cross-window signal and let the native
    // hit test in the main window make the final hide decision.
    if (now - lastPointerNotifyAtRef.current < 80) {
      return;
    }

    lastPointerNotifyAtRef.current = now;
    void notifyHistoryPreviewPointerEntered();
  };

  const markPointerNavigation = () => {
    setPreviewKeyboardNavigating(false);
  };

  const hoveredItem =
    preview?.kind === "group" && hoveredItemId !== null
      ? preview.items.find((item) => item.id === hoveredItemId) ?? null
      : null;

  useEffect(() => {
    const requestedItem = hoveredItem;
    const requestedPreview = preview?.kind === "group" ? preview : null;

    detailUpdateQueueRef.current = detailUpdateQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!requestedItem || !requestedPreview) {
          await hideHistoryPreviewDetailWindow();
          return;
        }

        if (hoveredItemIdRef.current !== requestedItem.id) {
          return;
        }

        const performanceInteractionId = createPerformanceInteractionId("previewdetail");

        await ensureAuxiliaryWindowReady("preview-detail");

        if (hoveredItemIdRef.current !== requestedItem.id) {
          return;
        }

        await updateHistoryPreviewDetailWindow({
          autoPaste: requestedPreview.autoPaste,
          appearanceTheme: requestedPreview.appearanceTheme,
          historyRevision: requestedPreview.historyRevision,
          item: requestedItem,
          kind: "item",
          language: requestedPreview.language,
          performanceInteractionId,
        });

        if (hoveredItemIdRef.current !== requestedItem.id) {
          return;
        }

        const detailAnchorTop = getGroupPreviewItemAnchorTop(requestedItem.id);
        if (detailAnchorTop === null) {
          return;
        }

        const placement = await showHistoryPreviewDetailWindow(
          detailAnchorTop,
          getItemPreviewHeight(requestedItem),
          GROUP_PREVIEW_DETAIL_WINDOW_WIDTH,
          performanceInteractionId,
        );

        if (hoveredItemIdRef.current !== requestedItem.id) {
          return;
        }

        await notifyHistoryPreviewPlacementUpdated(placement.group);
      })
      .catch((error) => {
        console.error("更新历史分组详情预览失败:", error);
      });
  }, [
    hoveredItem,
    preview,
  ]);

  if (!preview) {
    return null;
  }

  const t = getTranslations(preview.language).history;

  if (preview.kind === "item") {
    return (
      <HistoryItemPreviewWindow
        preview={preview}
        translations={t}
        onDeleteItem={(id) => {
          void deletePreviewItem(id);
        }}
        onPointerInside={notifyPointerInside}
        onTogglePinned={(id) => {
          void toggleHistoryItemPinned(id).catch((error) => {
            console.error("更新历史置顶状态失败:", error);
          });
        }}
        onViewFullscreen={() => {
          if (preview.item.kind !== "image") {
            return Promise.resolve();
          }

          return openImageViewer({
            appearanceTheme: preview.appearanceTheme,
            item: preview.item,
            language: preview.language,
          });
        }}
        onRequestClose={() => {
          void requestHistoryPreviewClose();
        }}
      />
    );
  }

  return (
    <HistoryGroupPreviewWindow
      hoveredItemId={hoveredItemId}
      isKeyboardNavigating={isKeyboardNavigating}
      preview={preview}
      translations={t}
      onHoveredItemChange={(id) => setActiveGroupPreviewItemId(id, "pointer")}
      onPointerNavigation={markPointerNavigation}
      onPointerInside={notifyPointerInside}
      onRequestClose={() => {
        void requestHistoryPreviewClose();
      }}
      onSelectItem={(id) => {
        void selectPreviewItem(id);
      }}
    />
  );
}
