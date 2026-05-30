// 独立 preview 窗口：展示某个历史分组内的条目，并允许直接点击复制。

import { useEffect, useRef, useState } from "react";

import { getTranslations } from "../i18n";
import {
  copyHistoryItem,
  deleteHistoryItem,
  hideHistoryPreviewWindow,
  hideMainWindow,
  listenToHistoryPreviewUpdated,
  notifyHistoryPreviewPointerEntered,
  requestHistoryPreviewClose,
} from "../lib/tauri";
import type { HistoryGroupInfo, HistoryListItem, HistoryPreviewPayload } from "../types";
import { ImageThumb } from "./ImageThumb";

function getLocalDisplayPosition(item: HistoryListItem, group: HistoryGroupInfo) {
  // item.position 是全局序号；preview 里显示的是当前分组内的相对序号。
  const localPosition = item.position - group.startPosition + 1;
  return String(localPosition);
}

function formatHistoryTimestamp(timestamp: number, language: HistoryPreviewPayload["language"]) {
  // language 的类型直接复用 payload 字段，避免这里和 types.ts 里的定义漂移。
  const locale = language === "zhCn" ? "zh-CN" : "en-US";

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function HistoryDetailContent({
  item,
  translations,
}: {
  item: HistoryListItem;
  translations: ReturnType<typeof getTranslations>["history"];
}) {
  // HistoryListItem 是联合类型，判断 kind 后 TypeScript 会自动收窄字段类型。
  if (item.kind === "image") {
    return (
      <div className="app-history-detail-image-wrap">
        <ImageThumb
          alt={item.displayText}
          className="app-history-detail-image"
          imagePath={item.imagePath}
        />
        <div className="app-history-detail-image-caption">
          {translations.imageSizeLabel(item.width, item.height)} · {item.byteSize > 1024 * 1024
            ? `${(item.byteSize / (1024 * 1024)).toFixed(1)} MB`
            : item.byteSize > 1024
              ? `${(item.byteSize / 1024).toFixed(0)} KB`
              : `${item.byteSize} B`}
        </div>
      </div>
    );
  }

  if (item.kind === "files") {
    return (
      <div className="app-history-detail-files">
        {item.filePaths.map((filePath) => (
          <div className="app-history-detail-file" key={filePath}>
            {filePath}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="app-history-detail-content">
      {item.text}
    </div>
  );
}

export function HistoryPreviewWindow() {
  // preview 为 null 时窗口没有可展示数据，组件会返回 null。
  const [preview, setPreview] = useState<HistoryPreviewPayload | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isDetailMetaOpen, setIsDetailMetaOpen] = useState(false);
  // ref 适合保存不参与渲染的可变值；这里记录上次通知主窗口的时间。
  const lastPointerNotifyAtRef = useRef(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // preview 窗口不主动读取历史，由主窗口通过事件推送当前分组数据。
    void listenToHistoryPreviewUpdated((payload) => {
      setPreview(payload);
      setHoveredItemId(null);
      setIsDetailMetaOpen(false);
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

      // 函数式 setState 可以拿到最新 state，适合基于当前 preview 删除某一项。
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

            <button
              className={`app-detail-meta-toggle ${isDetailMetaOpen ? "is-open" : ""}`}
              onClick={() => setIsDetailMetaOpen((prev) => !prev)}
              type="button"
            >
              <span className="app-detail-meta-toggle-label">{t.detailMetaToggle}</span>
              <span className="app-detail-meta-toggle-chevron" aria-hidden="true" />
            </button>

            {isDetailMetaOpen ? (
              <dl className="app-history-detail-meta">
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
            ) : null}
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
            // target 可能是按钮里的子元素，closest 可以向上找到带 data 属性的条目行。
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
                type="button"
              >
                <span className="app-history-preview-index">
                  {getLocalDisplayPosition(item, preview.group)}.
                </span>
                {item.kind === "image" ? (
                  <span className="app-item-thumbnail-wrap">
                    <ImageThumb
                      alt={item.displayText}
                      className="app-item-thumbnail"
                      imagePath={item.imagePath}
                    />
                    <span className="app-history-preview-text">{item.displayText}</span>
                  </span>
                ) : (
                  <span className="app-history-preview-text">{item.displayText}</span>
                )}
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
