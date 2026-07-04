// 历史分组 preview：只负责展示某个分组里的多条历史记录。

import { type CSSProperties, useCallback, useEffect, useRef } from "react";

import { getTranslations } from "../i18n";
import { getHistoryPreviewPointerPosition, type PreviewWindowSide } from "../lib/tauri";
import type { HistoryGroupInfo, HistoryGroupPreviewPayload, HistoryListItem } from "../types";
import {
  previewDeleteButton,
  previewItem,
  previewItemRow,
  previewWindow,
  ui,
} from "../uiStyles";
import {
  getTextHistoryAffordance,
  type HistoryTextAffordance,
} from "../utils/historyAffordance";
import { getHistoryListDisplayText } from "../utils/history";
import { shouldActivateGroupPreviewPointerItem } from "../utils/keyboardNavigation";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { ImageThumb } from "./ImageThumb";
import { TrashIcon } from "./UiIcons";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];
const POINTER_POLL_INTERVAL_MS = 48;

type HistoryGroupPreviewWindowProps = {
  detailSide: PreviewWindowSide;
  detailOffset: number;
  detailPreviewHeight: number | null;
  groupPreviewHeight: number;
  hoveredItemId: string | null;
  hoveredItem: HistoryListItem | null;
  isKeyboardNavigating: boolean;
  preview: HistoryGroupPreviewPayload;
  translations: HistoryTranslations;
  onDeleteItem: (id: string) => void;
  onHoveredItemChange: (id: string | null) => void;
  onPointerNavigation: () => void;
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

function renderHistoryTextAffordance(affordance: HistoryTextAffordance | null) {
  if (affordance === null) {
    return null;
  }

  if (affordance.kind === "color") {
    return (
      <span className={ui.historyAffordance} aria-hidden="true">
        <span
          className={ui.historyColorSwatch}
          style={{ background: affordance.color }}
        />
      </span>
    );
  }

  return (
    <span className={ui.historyAffordance} aria-hidden="true">
      <span className={ui.historyEmojiBadge}>{affordance.emoji}</span>
    </span>
  );
}

export function HistoryGroupPreviewWindow({
  detailSide,
  detailOffset,
  detailPreviewHeight,
  groupPreviewHeight,
  hoveredItemId,
  hoveredItem,
  isKeyboardNavigating,
  preview,
  translations,
  onDeleteItem,
  onHoveredItemChange,
  onPointerNavigation,
  onPointerInside,
  onRequestClose,
  onSelectItem,
}: HistoryGroupPreviewWindowProps) {
  const hoveredItemIdRef = useRef(hoveredItemId);
  const lastPolledPointerPositionRef = useRef<{ x: number; y: number } | null>(
    null,
  );
  const previewStyle = {
    "--detail-preview-offset": `${detailOffset}px`,
    "--detail-preview-height":
      detailPreviewHeight === null ? undefined : `${detailPreviewHeight}px`,
    "--group-preview-height": `${groupPreviewHeight}px`,
  } as CSSProperties;
  const detailPanel =
    hoveredItem === null ? null : (
      <div className={ui.historyGroupDetailPane}>
        <HistoryDetailPanel
          ariaLabel={translations.itemPreviewAriaLabel}
          className={ui.historyGroupHoverDetail}
          item={hoveredItem}
          language={preview.language}
          role="region"
          translations={translations}
        />
      </div>
    );

  useEffect(() => {
    hoveredItemIdRef.current = hoveredItemId;
  }, [hoveredItemId]);

  const activateItem = useCallback((id: string) => {
    onPointerNavigation();

    if (hoveredItemIdRef.current === id) {
      return;
    }

    hoveredItemIdRef.current = id;
    onHoveredItemChange(id);
  }, [onHoveredItemChange, onPointerNavigation]);

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

          const previousPosition = lastPolledPointerPositionRef.current;
          const hasPointerMoved =
            previousPosition !== null &&
            (previousPosition.x !== position.x || previousPosition.y !== position.y);
          lastPolledPointerPositionRef.current = {
            x: position.x,
            y: position.y,
          };
          const itemId = findPreviewItemId(
            document.elementFromPoint(position.x, position.y),
          );

          if (
            itemId &&
            shouldActivateGroupPreviewPointerItem({
              hasPointerMoved,
              isKeyboardNavigating,
              itemId,
            })
          ) {
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
  }, [activateItem, isKeyboardNavigating, onPointerInside]);

  return (
    <div
      className={previewWindow(Boolean(hoveredItem), detailSide, isKeyboardNavigating)}
      style={previewStyle}
      onMouseEnter={onPointerInside}
      onMouseMove={onPointerInside}
      onMouseLeave={() => {
        onRequestClose();
      }}
    >
      {detailSide === "left" ? detailPanel : null}
      <div
        aria-label={translations.previewAriaLabel(
          preview.group.startPosition,
          preview.group.endPosition,
        )}
        className={`${ui.historyPreview} ${ui.historyGroupPreview}`}
        role="menu"
      >
        <div className={ui.historyPreviewHeader}>
          <span className={ui.historyPreviewKicker}>
            {translations.groupPreviewKicker}
          </span>
          <span className={ui.historyPreviewRange}>
            {preview.group.startPosition} - {preview.group.endPosition}
          </span>
        </div>

        <div className={ui.historyGroupPreviewBody}>
          <div
            className={ui.historyPreviewList}
            onPointerMove={(event) => {
              // target 可能是按钮里的子元素，closest 可以向上找到带 data 属性的条目行。
              const itemId = findPreviewItemId(event.target);
              if (itemId) {
                activateItem(itemId);
              }
            }}
          >
            {preview.items.map((item) => {
              const displayText = getHistoryListDisplayText(item);
              const textAffordance =
                item.kind === "text" ? getTextHistoryAffordance(item.text) : null;

              return (
                <div
                  className={previewItemRow(
                    item.id === hoveredItemId,
                    isKeyboardNavigating,
                  )}
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
                    className={previewItem(preview.showHistoryItemNumbers)}
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
                    {preview.showHistoryItemNumbers ? (
                      <span className={ui.historyPreviewIndex}>
                        {getLocalDisplayPosition(item, preview.group)}.
                      </span>
                    ) : null}
                    {item.kind === "image" ? (
                      <span className={ui.itemThumbnailWrap}>
                        <ImageThumb
                          alt={displayText}
                          className={ui.itemThumbnail}
                          imagePath={item.imagePath}
                        />
                        <span className={ui.historyPreviewText}>{displayText}</span>
                      </span>
                    ) : (
                      <span
                        className={`${ui.historyPreviewText} ${
                          textAffordance ? ui.historyTextWithAffordance : ""
                        }`}
                      >
                        {renderHistoryTextAffordance(textAffordance)}
                        <span className={ui.historyDisplayText}>{displayText}</span>
                      </span>
                    )}
                  </button>
                  <button
                    aria-label={translations.deleteItemAriaLabel}
                    className={previewDeleteButton(item.id === hoveredItemId)}
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
                    <TrashIcon className={ui.deleteIcon} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {detailSide === "right" ? detailPanel : null}
    </div>
  );
}
