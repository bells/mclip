// 历史分组 preview：只负责展示某个分组里的多条历史记录。

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { getTranslations } from "../i18n";
import {
  getHistoryPreviewPointerPosition,
  reportHistoryPreviewMeasured,
} from "../lib/tauri";
import type { HistoryGroupPreviewPayload } from "../types";
import { previewItem, previewItemRow, ui } from "../uiStyles";
import { getHistoryListDisplayText } from "../utils/history";
import { shouldActivateGroupPreviewPointerItem } from "../utils/keyboardNavigation";
import {
  getGroupPreviewNaturalHeight,
  shouldApplyMeasuredPreviewHeight,
} from "../utils/preview";
import { isSensitiveTextEntry } from "../utils/sensitiveContent";
import { HistoryListText } from "./HistoryListText";
import { ImageThumb } from "./ImageThumb";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];
const POINTER_POLL_INTERVAL_MS = 48;

type HistoryGroupPreviewWindowProps = {
  hoveredItemId: string | null;
  isKeyboardNavigating: boolean;
  preview: HistoryGroupPreviewPayload;
  translations: HistoryTranslations;
  onHoveredItemChange: (id: string | null) => void;
  onPointerNavigation: () => void;
  onPointerInside: () => void;
  onRequestClose: () => void;
  onSelectItem: (id: string) => void;
};

function getLocalDisplayPosition(itemIndex: number) {
  // 分组 payload 已按未置顶历史切片；直接使用本组索引，避免置顶项改变全局序号后造成偏移。
  return String(itemIndex + 1);
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
  isKeyboardNavigating,
  preview,
  translations,
  onHoveredItemChange,
  onPointerNavigation,
  onPointerInside,
  onRequestClose,
  onSelectItem,
}: HistoryGroupPreviewWindowProps) {
  const hoveredItemIdRef = useRef(hoveredItemId);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastReportedHeightRef = useRef<number | null>(null);
  const lastPolledPointerPositionRef = useRef<{ x: number; y: number } | null>(
    null,
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

  const reportNaturalHeight = useCallback(() => {
    const panel = panelRef.current;
    const header = headerRef.current;
    const list = listRef.current;

    if (!panel || !header || !list) {
      return;
    }

    const panelStyle = window.getComputedStyle(panel);
    const borderHeight =
      Number.parseFloat(panelStyle.borderTopWidth) +
      Number.parseFloat(panelStyle.borderBottomWidth);
    const measuredHeight = getGroupPreviewNaturalHeight(
      header.getBoundingClientRect().height,
      list.scrollHeight,
      Number.isFinite(borderHeight) ? borderHeight : 0,
    );

    if (
      measuredHeight === null ||
      !shouldApplyMeasuredPreviewHeight(
        lastReportedHeightRef.current,
        measuredHeight,
      )
    ) {
      return;
    }

    lastReportedHeightRef.current = measuredHeight;
    void reportHistoryPreviewMeasured({
      groupIndex: preview.group.index,
      height: measuredHeight,
    }).catch((error) => {
      console.error("上报历史分组预览高度失败:", error);
    });
  }, [preview.group.index]);

  useLayoutEffect(() => {
    lastReportedHeightRef.current = null;
    const animationFrameId = window.requestAnimationFrame(reportNaturalHeight);
    const resizeObserver = new ResizeObserver(reportNaturalHeight);
    const header = headerRef.current;
    const list = listRef.current;

    if (header) {
      resizeObserver.observe(header);
    }
    if (list) {
      resizeObserver.observe(list);
    }
    window.addEventListener("resize", reportNaturalHeight);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", reportNaturalHeight);
    };
  }, [preview.items, reportNaturalHeight]);

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
      className={`${ui.historyGroupPreviewWindow} ${
        isKeyboardNavigating ? "is-keyboard-navigating" : ""
      }`}
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
        className={`${ui.historyPreview} ${ui.historyGroupPreview}`}
        ref={panelRef}
        role="menu"
      >
        <div className={ui.historyPreviewHeader} ref={headerRef}>
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
            ref={listRef}
            onPointerMove={(event) => {
              // target 可能是按钮里的子元素，closest 可以向上找到带 data 属性的条目行。
              const itemId = findPreviewItemId(event.target);
              if (itemId) {
                activateItem(itemId);
              }
            }}
          >
            {preview.items.map((item, itemIndex) => {
              const displayText = getHistoryListDisplayText(item);

              return (
                <div
                  className={previewItemRow(
                    item.kind,
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
                    className={previewItem(
                      item.kind,
                      preview.showHistoryItemNumbers,
                    )}
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
                        {getLocalDisplayPosition(itemIndex)}.
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
                    ) : item.kind === "text" ? (
                      <HistoryListText
                        className={ui.historyPreviewText}
                        displayText={displayText}
                        isSensitive={isSensitiveTextEntry(item)}
                        sensitiveLabel={translations.sensitiveBadge}
                        text={item.text}
                      />
                    ) : (
                      <span className={ui.historyPreviewText}>{displayText}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
