// 分组 hover 详情使用独立 preview 窗口，避免被分组列表高度牵连。

import { useEffect, useRef, useState } from "react";

import { useApplyAppTheme } from "../hooks/useApplyAppTheme";
import { getTranslations } from "../i18n";
import {
  deleteHistoryItem,
  hideHistoryPreviewDetailWindow,
  listenToHistoryPreviewDetailUpdated,
  listenToHistoryPreviewInvalidated,
  listenToHistoryPreviewPlacementUpdated,
  notifyHistoryPreviewPointerEntered,
  openImageViewer,
  toggleHistoryItemPinned,
  requestHistoryPreviewClose,
  type PreviewWindowSide,
} from "../lib/tauri";
import type { HistoryItemPreviewPayload } from "../types";
import { ui } from "../uiStyles";
import { recordFrontendPerformanceAfterPaint } from "../services/performance";
import { reportAuxiliaryListenerReady } from "../services/auxiliaryWindows";
import { maskSensitiveHistoryEntry } from "../utils/sensitiveContent";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { HistoryDetailDeleteButton } from "./HistoryDetailDeleteButton";
import { HistoryDetailFullscreenButton } from "./HistoryDetailFullscreenButton";
import { HistoryPinButton } from "./HistoryPinButton";

export function HistoryPreviewDetailWindow() {
  const [preview, setPreview] = useState<HistoryItemPreviewPayload | null>(null);
  const [previewSide, setPreviewSide] = useState<PreviewWindowSide>("right");
  const [isDeleting, setIsDeleting] = useState(false);
  const lastPointerNotifyAtRef = useRef(0);
  useApplyAppTheme(preview?.appearanceTheme ?? "system");

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenToHistoryPreviewDetailUpdated((payload) => {
      setPreview(payload);
      setIsDeleting(false);
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
      reportAuxiliaryListenerReady("previewDetailUpdated");
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenToHistoryPreviewInvalidated((invalidation) => {
      if (invalidation.kind !== "upsert" || invalidation.closeCurrentPreview) {
        return;
      }
      setPreview((current) =>
        current && current.item.id === invalidation.entry.id
          ? {
              ...current,
              historyRevision: invalidation.revision,
              item: maskSensitiveHistoryEntry(
                {
                  ...invalidation.entry,
                  position: current.item.position,
                  renderId: current.item.renderId,
                },
                current.maskSensitiveContent,
              ),
            }
          : current,
      );
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (preview) {
      recordFrontendPerformanceAfterPaint("previewPainted", {
        interactionId: preview.performanceInteractionId,
        windowLabel: "preview-detail",
      });
    }
  }, [preview]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenToHistoryPreviewPlacementUpdated((placement) => {
      setPreviewSide(placement.side);
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
      reportAuxiliaryListenerReady("placementUpdated");
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const notifyPointerInside = () => {
    const now = Date.now();

    if (now - lastPointerNotifyAtRef.current < 80) {
      return;
    }

    lastPointerNotifyAtRef.current = now;
    void notifyHistoryPreviewPointerEntered();
  };

  if (!preview) {
    return null;
  }

  const translations = getTranslations(preview.language).history;
  const imageItem = preview.item.kind === "image" ? preview.item : null;
  const deletePreviewItem = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteHistoryItem(preview.item.id);
      setPreview(null);
      await hideHistoryPreviewDetailWindow();
    } catch (error) {
      setIsDeleting(false);
      console.error("删除历史分组详情记录失败:", error);
    }
  };

  return (
    <div
      className={ui.historyPreviewDetailWindow}
      data-preview-side={previewSide}
      onMouseEnter={notifyPointerInside}
      onMouseMove={notifyPointerInside}
      onMouseLeave={() => {
        void requestHistoryPreviewClose();
      }}
    >
      <HistoryDetailPanel
        ariaLabel={translations.itemPreviewAriaLabel}
        appearanceTheme={preview.appearanceTheme}
        headerAction={
          <>
            <HistoryPinButton
              disabled={isDeleting}
              isPinned={preview.item.isPinned}
              label={preview.item.isPinned ? translations.unpinItemAriaLabel : translations.pinItemAriaLabel}
              onToggle={() => {
                void toggleHistoryItemPinned(preview.item.id);
              }}
            />
            {imageItem ? (
              <HistoryDetailFullscreenButton
                disabled={isDeleting}
                label={translations.viewImageFullscreenAriaLabel}
                onOpen={() =>
                  openImageViewer({
                    appearanceTheme: preview.appearanceTheme,
                    item: imageItem,
                    language: preview.language,
                  })
                }
              />
            ) : null}
            <HistoryDetailDeleteButton
              disabled={isDeleting}
              label={translations.deleteItemAriaLabel}
              onDelete={() => {
                void deletePreviewItem();
              }}
            />
          </>
        }
        item={preview.item}
        language={preview.language}
        onSensitiveItemStale={() => {
          setPreview(null);
          void hideHistoryPreviewDetailWindow();
        }}
        performanceInteractionId={preview.performanceInteractionId}
        role="region"
        translations={translations}
      />
    </div>
  );
}
