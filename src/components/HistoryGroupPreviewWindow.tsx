// 历史分组 preview：只负责展示某个分组里的多条历史记录。

import { useCallback, useEffect, useRef } from "react";

import { getTranslations } from "../i18n";
import { getHistoryPreviewPointerPosition } from "../lib/tauri";
import type { HistoryGroupInfo, HistoryGroupPreviewPayload, HistoryListItem } from "../types";
import { ImageThumb } from "./ImageThumb";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];
const POINTER_POLL_INTERVAL_MS = 48;

type HistoryGroupPreviewWindowProps = {
  hoveredItemId: string | null;
  preview: HistoryGroupPreviewPayload;
  translations: HistoryTranslations;
  onDeleteItem: (id: string) => void;
  onHoveredItemChange: (id: string | null) => void;
  onPointerInside: () => void;
  onRequestClose: () => void;
  onSelectItem: (id: string) => void;
};

function getLocalDisplayPosition(item: HistoryListItem, group: HistoryGroupInfo) {
  // item.position 是全局序号；preview 里显示的是当前分组内的相对序号。
  const localPosition = item.position - group.startPosition + 1;
  return String(localPosition);
}

function findPreviewItemId(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>("[data-preview-item-id]")?.dataset
    .previewItemId ?? null;
}

export function HistoryGroupPreviewWindow({
  hoveredItemId,
  preview,
  translations,
  onDeleteItem,
  onHoveredItemChange,
  onPointerInside,
  onRequestClose,
  onSelectItem,
}: HistoryGroupPreviewWindowProps) {
  const hoveredItemIdRef = useRef(hoveredItemId);

  useEffect(() => {
    hoveredItemIdRef.current = hoveredItemId;
  }, [hoveredItemId]);

  const activateItem = useCallback((id: string) => {
    if (hoveredItemIdRef.current === id) {
      return;
    }

    hoveredItemIdRef.current = id;
    onHoveredItemChange(id);
  }, [onHoveredItemChange]);

  const clearActiveItem = useCallback(() => {
    if (hoveredItemIdRef.current === null) {
      return;
    }

    hoveredItemIdRef.current = null;
    onHoveredItemChange(null);
  }, [onHoveredItemChange]);

  useEffect(() => {
    let isCancelled = false;
    let timerId: number | null = null;
    let isPolling = false;

    const pollPointerPosition = async () => {
      if (isCancelled || isPolling) {
        return;
      }

      isPolling = true;

      try {
        const position = await getHistoryPreviewPointerPosition();

        if (!isCancelled && position) {
          onPointerInside();

          const itemId = findPreviewItemId(
            document.elementFromPoint(position.x, position.y),
          );

          if (itemId) {
            activateItem(itemId);
          }
        }
      } catch (error) {
        console.error("检测历史分组预览鼠标位置失败:", error);
      } finally {
        isPolling = false;

        if (!isCancelled) {
          timerId = window.setTimeout(() => {
            void pollPointerPosition();
          }, POINTER_POLL_INTERVAL_MS);
        }
      }
    };

    void pollPointerPosition();

    return () => {
      isCancelled = true;

      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [activateItem, onPointerInside]);

  return (
    <div
      className="history-preview-window app-history-group-preview-window"
      onMouseEnter={onPointerInside}
      onMouseMove={onPointerInside}
      onMouseLeave={() => {
        onRequestClose();
      }}
    >
      <div
        aria-label={translations.previewAriaLabel(
          preview.group.startPosition,
          preview.group.endPosition,
        )}
        className="app-history-preview app-history-group-preview"
        role="menu"
      >
        <div className="app-history-preview-header">
          <span className="app-history-preview-kicker">
            {translations.groupPreviewKicker}
          </span>
          <span className="app-history-preview-range">
            {preview.group.startPosition} - {preview.group.endPosition}
          </span>
        </div>

        <div className="app-history-group-preview-body">
          <div
            className="app-history-preview-list"
            onPointerMove={(event) => {
              // target 可能是按钮里的子元素，closest 可以向上找到带 data 属性的条目行。
              const itemId = findPreviewItemId(event.target);
              if (itemId) {
                activateItem(itemId);
              }
            }}
          >
            {preview.items.map((item) => (
              <div
                className={`app-history-preview-item-row ${
                  item.id === hoveredItemId ? "is-selected" : ""
                }`}
                data-preview-item-id={item.id}
                key={item.id}
                onMouseEnter={() => {
                  activateItem(item.id);
                }}
                onMouseMove={() => {
                  activateItem(item.id);
                }}
                onPointerEnter={() => {
                  activateItem(item.id);
                }}
                onPointerMove={() => {
                  activateItem(item.id);
                }}
              >
                <button
                  className="app-history-preview-item"
                  onFocus={() => {
                    activateItem(item.id);
                  }}
                  onMouseEnter={() => {
                    activateItem(item.id);
                  }}
                  onMouseMove={() => {
                    activateItem(item.id);
                  }}
                  onPointerEnter={() => {
                    activateItem(item.id);
                  }}
                  onPointerMove={() => {
                    activateItem(item.id);
                  }}
                  onClick={() => {
                    onSelectItem(item.id);
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
                  aria-label={translations.deleteItemAriaLabel}
                  className="app-history-preview-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (hoveredItemIdRef.current === item.id) {
                      clearActiveItem();
                    }
                    onDeleteItem(item.id);
                  }}
                  title={translations.deleteItemAriaLabel}
                  type="button"
                >
                  <span className="app-item-delete-icon" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
