// 独立 preview 窗口：展示某个历史分组内的条目，并允许直接点击复制。

import { useEffect, useRef, useState } from "react";

import { getTranslations } from "../i18n";
import {
  copyToClipboard,
  hideHistoryPreviewWindow,
  hideMainWindow,
  listenToHistoryPreviewUpdated,
  notifyHistoryPreviewPointerEntered,
  requestHistoryPreviewClose,
} from "../lib/tauri";
import type { HistoryGroupInfo, HistoryListItem, HistoryPreviewPayload } from "../types";

function getLocalDisplayPosition(item: HistoryListItem, group: HistoryGroupInfo) {
  const localPosition = item.position - group.startPosition + 1;
  return String(localPosition);
}

export function HistoryPreviewWindow() {
  const [preview, setPreview] = useState<HistoryPreviewPayload | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const lastPointerNotifyAtRef = useRef(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // preview 窗口不主动读取历史，由主窗口通过事件推送当前分组数据。
    void listenToHistoryPreviewUpdated((payload) => {
      setPreview(payload);
      setHoveredItemId(null);
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const selectPreviewItem = async (text: string) => {
    try {
      await copyToClipboard(text);
      await hideHistoryPreviewWindow();
      await hideMainWindow();
    } catch (error) {
      console.error("复制历史分组记录失败:", error);
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

  if (!preview) {
    return null;
  }

  const t = getTranslations(preview.language).history;

  return (
    <div
      className="history-preview-window"
      onMouseEnter={() => {
        notifyPointerInside();
      }}
      onMouseMove={() => {
        notifyPointerInside();
      }}
      onMouseLeave={() => {
        setHoveredItemId(null);
        void requestHistoryPreviewClose();
      }}
    >
      <div
        aria-label={t.previewAriaLabel(
          preview.group.startPosition,
          preview.group.endPosition,
        )}
        className="app-history-preview"
        role="menu"
      >
        <div className="app-history-preview-header">
          <span className="app-history-preview-kicker">{t.groupPreviewKicker}</span>
          <span className="app-history-preview-range">
            {preview.group.startPosition} - {preview.group.endPosition}
          </span>
        </div>

        <div
          className="app-history-preview-list"
          onPointerLeave={() => {
            setHoveredItemId(null);
          }}
          onPointerMove={(event) => {
            // 用 pointermove 主动追踪当前条目，比单纯 CSS :hover 更能覆盖透明子窗口场景。
            const previewItem = (event.target as Element).closest<HTMLElement>(
              "[data-preview-item-id]",
            );
            setHoveredItemId(previewItem?.dataset.previewItemId ?? null);
          }}
        >
          {preview.items.map((item) => (
            <button
              className={`app-history-preview-item ${
                item.id === hoveredItemId ? "is-selected" : ""
              }`}
              data-preview-item-id={item.id}
              key={item.id}
              onClick={() => {
                void selectPreviewItem(item.text);
              }}
              title={item.text}
              type="button"
            >
              <span className="app-history-preview-index">
                {getLocalDisplayPosition(item, preview.group)}.
              </span>
              <span className="app-history-preview-text">{item.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
