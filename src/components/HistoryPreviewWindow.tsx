// 独立 preview 窗口：展示某个历史分组内的条目，并允许直接点击复制。

import { useEffect, useRef, useState } from "react";

import { getTranslations } from "../i18n";
import {
  copyHistoryItem,
  deleteHistoryItem,
  getAssetUrl,
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

function formatHistoryTimestamp(timestamp: number, language: HistoryPreviewPayload["language"]) {
  const locale = language === "zhCn" ? "zh-CN" : "en-US";

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function getHistoryItemTitle(item: HistoryListItem) {
  switch (item.kind) {
    case "text":
      return item.text;
    case "url":
      return item.url;
    case "files":
      return item.filePaths.join("\n");
    case "image":
      return item.displayText;
  }
}

function HistoryDetailContent({
  item,
  translations,
}: {
  item: HistoryListItem;
  translations: ReturnType<typeof getTranslations>["history"];
}) {
  if (item.kind === "image") {
    return (
      <div className="app-history-detail-image-wrap">
        <img
          alt={item.displayText}
          className="app-history-detail-image"
          draggable={false}
          src={getAssetUrl(item.imagePath)}
        />
        <div className="app-history-detail-image-caption">
          {translations.imageSizeLabel(item.width, item.height)}
        </div>
      </div>
    );
  }

  if (item.kind === "files") {
    return (
      <div className="app-history-detail-files">
        {item.filePaths.map((filePath) => (
          <div className="app-history-detail-file" key={filePath} title={filePath}>
            {filePath}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="app-history-detail-content" title={getHistoryItemTitle(item)}>
      {item.kind === "url" ? item.url : item.text}
    </div>
  );
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

  const selectPreviewItem = async (id: string) => {
    try {
      await copyHistoryItem(id);
      await hideHistoryPreviewWindow();
      await hideMainWindow();
    } catch (error) {
      console.error("复制历史分组记录失败:", error);
    }
  };

  const deletePreviewItem = async (id: string) => {
    try {
      await deleteHistoryItem(id);

      setPreview((currentPreview) => {
        if (!currentPreview) {
          return currentPreview;
        }

        if (currentPreview.kind === "item") {
          if (currentPreview.item.id === id) {
            void hideHistoryPreviewWindow();
            return null;
          }

          return currentPreview;
        }

        const nextItems = currentPreview.items.filter((item) => item.id !== id);

        if (nextItems.length === 0) {
          void hideHistoryPreviewWindow();
          return null;
        }

        return {
          ...currentPreview,
          items: nextItems,
        };
      });
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

  if (!preview) {
    return null;
  }

  const t = getTranslations(preview.language).history;

  if (preview.kind === "item") {
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
          void requestHistoryPreviewClose();
        }}
      >
        <div
          aria-label={t.itemPreviewAriaLabel}
          className="app-history-preview app-history-detail-preview"
          role="dialog"
        >
          <div className="app-history-preview-header">
            <span className="app-history-preview-kicker">{t.itemPreviewKicker}</span>
            <span className="app-history-preview-range">
              {t.kindLabels[preview.item.kind]} #{preview.item.position}
            </span>
          </div>

          <div className="app-history-detail-body">
            <HistoryDetailContent item={preview.item} translations={t} />

            <dl className="app-history-detail-meta">
              <div>
                <dt>{t.contentLabel}</dt>
                <dd>{preview.item.displayText}</dd>
              </div>
              <div>
                <dt>{t.sourceAppLabel}</dt>
                <dd>{preview.item.sourceApp ?? t.sourceAppFallback}</dd>
              </div>
              <div>
                <dt>{t.firstCopiedTimeLabel}</dt>
                <dd>
                  {formatHistoryTimestamp(preview.item.firstCopiedAt, preview.language)}
                </dd>
              </div>
              <div>
                <dt>{t.lastCopiedTimeLabel}</dt>
                <dd>
                  {formatHistoryTimestamp(preview.item.lastCopiedAt, preview.language)}
                </dd>
              </div>
              <div>
                <dt>{t.copyCountLabel}</dt>
                <dd>{preview.item.copyCount}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    );
  }

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
            <div
              className={`app-history-preview-item-row ${
                item.id === hoveredItemId ? "is-selected" : ""
              }`}
              data-preview-item-id={item.id}
              key={item.id}
            >
              <button
                className="app-history-preview-item"
                onClick={() => {
                  void selectPreviewItem(item.id);
                }}
                title={getHistoryItemTitle(item)}
                type="button"
              >
                <span className="app-history-preview-index">
                  {getLocalDisplayPosition(item, preview.group)}.
                </span>
                <span className={`app-history-preview-kind app-history-preview-kind-${item.kind}`}>
                  {t.kindLabels[item.kind]}
                </span>
                <span className="app-history-preview-text">{item.displayText}</span>
                <span className="app-history-preview-meta">
                  <span>
                    {t.sourceAppLabel}: {item.sourceApp ?? t.sourceAppFallback}
                  </span>
                  <span>
                    {t.firstCopiedTimeLabel}:{" "}
                    {formatHistoryTimestamp(item.firstCopiedAt, preview.language)}
                  </span>
                  <span>
                    {t.lastCopiedTimeLabel}:{" "}
                    {formatHistoryTimestamp(item.lastCopiedAt, preview.language)}
                    <span aria-hidden="true"> · </span>
                    {t.copyCountLabel}: {item.copyCount}
                  </span>
                </span>
              </button>
              <button
                aria-label={t.deleteItemAriaLabel}
                className="app-history-preview-delete"
                onClick={(event) => {
                  event.stopPropagation();
                  void deletePreviewItem(item.id);
                }}
                title={t.deleteItemAriaLabel}
                type="button"
              >
                <span className="app-item-delete-icon" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
