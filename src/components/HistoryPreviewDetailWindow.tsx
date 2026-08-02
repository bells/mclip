// 分组 hover 详情使用独立 preview 窗口，避免被分组列表高度牵连。

import { useEffect, useRef, useState } from "react";

import { useApplyAppTheme } from "../hooks/useApplyAppTheme";
import { getTranslations } from "../i18n";
import {
  deleteHistoryItem,
  hideHistoryPreviewDetailWindow,
  listenToHistoryPreviewDetailUpdated,
  listenToHistoryPreviewPlacementUpdated,
  notifyHistoryPreviewPointerEntered,
  openImageViewer,
  requestHistoryPreviewClose,
  type PreviewWindowSide,
} from "../lib/tauri";
import type { HistoryItemPreviewPayload } from "../types";
import { ui } from "../uiStyles";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { HistoryDetailDeleteButton } from "./HistoryDetailDeleteButton";
import { HistoryDetailFullscreenButton } from "./HistoryDetailFullscreenButton";

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
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenToHistoryPreviewPlacementUpdated((placement) => {
      setPreviewSide(placement.side);
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
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
        headerAction={
          <>
            {imageItem ? (
              <HistoryDetailFullscreenButton
                disabled={isDeleting}
                label={translations.viewImageFullscreenAriaLabel}
                onOpen={() =>
                  openImageViewer({
                    alt: imageItem.displayText,
                    appearanceTheme: preview.appearanceTheme,
                    height: imageItem.height,
                    imagePath: imageItem.imagePath,
                    language: preview.language,
                    width: imageItem.width,
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
        role="region"
        translations={translations}
      />
    </div>
  );
}
