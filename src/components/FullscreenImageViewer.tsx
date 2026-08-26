import { useCallback, useEffect, useRef, useState } from "react";

import { useApplyAppTheme } from "../hooks/useApplyAppTheme";
import { getTranslations } from "../i18n";
import {
  closeImageViewer,
  deleteHistoryItem,
  listenToImageViewerUpdated,
  listenToHistoryPreviewInvalidated,
  toggleHistoryItemPinned,
  toggleImageViewerMaximize,
} from "../lib/tauri";
import type { ImageViewerPayload } from "../types";
import { ui } from "../uiStyles";
import { recordFrontendPerformanceAfterPaint } from "../services/performance";
import { reportAuxiliaryListenerReady } from "../services/auxiliaryWindows";
import { DialogWindowFrame } from "./DialogWindowFrame";
import { HistoryDetailDeleteButton } from "./HistoryDetailDeleteButton";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { HistoryPinButton } from "./HistoryPinButton";
import { CloseIcon, ExpandIcon, RestoreIcon } from "./UiIcons";

export function FullscreenImageViewer() {
  const [payload, setPayload] = useState<ImageViewerPayload | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingSize, setIsChangingSize] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const isClosingRef = useRef(false);
  const translations = getTranslations(payload?.language ?? "system");
  useApplyAppTheme(payload?.appearanceTheme ?? "system");

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | undefined;

    void listenToImageViewerUpdated((nextPayload) => {
      isClosingRef.current = false;
      setIsClosing(false);
      setIsDeleting(false);
      setIsChangingSize(false);
      setIsMaximized(true);
      setPayload(nextPayload);
    }).then((unsubscribe) => {
      if (isActive) {
        unlisten = unsubscribe;
        reportAuxiliaryListenerReady("imageViewerUpdated");
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
    let unlisten: (() => void) | undefined;
    void listenToHistoryPreviewInvalidated((invalidation) => {
      if (invalidation.kind !== "upsert" || invalidation.closeCurrentPreview) {
        return;
      }
      setPayload((current) =>
        current &&
        current.item.id === invalidation.entry.id &&
        invalidation.entry.kind === "image"
          ? {
              ...current,
              item: {
                ...invalidation.entry,
                position: current.item.position,
                renderId: current.item.renderId,
              },
            }
          : current,
      );
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });
    return () => unlisten?.();
  }, []);

  const requestToggleMaximize = useCallback(async () => {
    if (isChangingSize || isClosingRef.current) {
      return;
    }

    setIsChangingSize(true);

    try {
      setIsMaximized(await toggleImageViewerMaximize());
    } catch (error) {
      console.error("切换图片查看器窗口尺寸失败:", error);
    } finally {
      setIsChangingSize(false);
    }
  }, [isChangingSize]);

  const requestClose = useCallback(async () => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    setIsClosing(true);

    try {
      await closeImageViewer();
      setPayload(null);
    } catch (error) {
      isClosingRef.current = false;
      setIsClosing(false);
      console.error("关闭图片查看器失败:", error);
    }
  }, []);

  const requestDelete = useCallback(async () => {
    if (!payload || isDeleting || isClosingRef.current) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteHistoryItem(payload.item.id);
    } catch (error) {
      setIsDeleting(false);
      console.error("从图片查看器删除历史记录失败:", error);
      return;
    }

    await requestClose();
    setIsDeleting(false);
  }, [isDeleting, payload, requestClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void requestClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [requestClose]);

  useEffect(() => {
    if (payload) {
      recordFrontendPerformanceAfterPaint("viewerPainted", {
        interactionId: payload.performanceInteractionId,
        windowLabel: "image-viewer",
      });
    }
  }, [payload]);

  if (!payload) {
    return null;
  }

  return (
    <DialogWindowFrame className={ui.imageViewerWindowFrame}>
      <HistoryDetailPanel
        ariaLabel={translations.imageViewer.ariaLabel}
        className={ui.imageViewerDetail}
        draggableHeader
        headerAction={
          <>
            <HistoryPinButton
              disabled={isClosing || isDeleting}
              isPinned={payload.item.isPinned}
              label={payload.item.isPinned ? translations.history.unpinItemAriaLabel : translations.history.pinItemAriaLabel}
              onToggle={() => {
                void toggleHistoryItemPinned(payload.item.id);
              }}
            />
            <button
              aria-label={
                isMaximized
                  ? translations.imageViewer.restoreAriaLabel
                  : translations.imageViewer.maximizeAriaLabel
              }
              aria-pressed={isMaximized}
              className={ui.historyDetailFullscreenButton}
              disabled={isChangingSize || isClosing || isDeleting}
              onClick={() => {
                void requestToggleMaximize();
              }}
              title={
                isMaximized
                  ? translations.imageViewer.restoreAriaLabel
                  : translations.imageViewer.maximizeAriaLabel
              }
              type="button"
            >
              {isMaximized ? (
                <RestoreIcon className={ui.fullscreenIcon} />
              ) : (
                <ExpandIcon className={ui.fullscreenIcon} />
              )}
            </button>

            <HistoryDetailDeleteButton
              disabled={isDeleting || isClosing}
              label={translations.history.deleteItemAriaLabel}
              onDelete={() => {
                void requestDelete();
              }}
            />

            <button
              aria-label={translations.imageViewer.closeAriaLabel}
              className={ui.historyDetailFullscreenButton}
              disabled={isClosing || isDeleting}
              onClick={() => {
                void requestClose();
              }}
              title={translations.imageViewer.closeAriaLabel}
              type="button"
            >
              <CloseIcon className={ui.fullscreenIcon} />
            </button>
          </>
        }
        item={payload.item}
        language={payload.language}
        performanceInteractionId={payload.performanceInteractionId}
        presentation="viewer"
        role="dialog"
        translations={translations.history}
      />
    </DialogWindowFrame>
  );
}
