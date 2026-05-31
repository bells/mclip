// 分组 hover 详情使用独立 preview 窗口，避免被分组列表高度牵连。

import { useEffect, useRef, useState } from "react";

import { getTranslations } from "../i18n";
import {
  listenToHistoryPreviewPlacementUpdated,
  listenToHistoryPreviewUpdated,
  notifyHistoryPreviewPointerEntered,
  requestHistoryPreviewClose,
  type PreviewWindowSide,
} from "../lib/tauri";
import type { HistoryItemPreviewPayload } from "../types";
import { HistoryDetailPanel } from "./HistoryDetailPanel";

export function HistoryPreviewDetailWindow() {
  const [preview, setPreview] = useState<HistoryItemPreviewPayload | null>(null);
  const [previewSide, setPreviewSide] = useState<PreviewWindowSide>("right");
  const lastPointerNotifyAtRef = useRef(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenToHistoryPreviewUpdated((payload) => {
      setPreview(payload.kind === "item" ? payload : null);
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

  return (
    <div
      className={`history-preview-window app-history-preview-detail-window ${
        previewSide === "left" ? "is-left-side" : "is-right-side"
      }`}
      onMouseEnter={notifyPointerInside}
      onMouseMove={notifyPointerInside}
      onMouseLeave={() => {
        void requestHistoryPreviewClose();
      }}
    >
      <HistoryDetailPanel
        ariaLabel={translations.itemPreviewAriaLabel}
        item={preview.item}
        language={preview.language}
        role="region"
        translations={translations}
      />
    </div>
  );
}
