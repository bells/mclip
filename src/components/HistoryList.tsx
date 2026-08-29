// 主历史列表：展示设置允许的最新记录或搜索结果，并支持点击复制。

import type { AppTranslations } from "../i18n";
import type { HistoryListItem } from "../types";
import { historyItem, historyItemRow, ui } from "../uiStyles";
import { getHistoryListDisplayText } from "../utils/history";
import { serializeMainKeyboardNavigationTarget } from "../utils/keyboardNavigation";
import { ImageThumb } from "./ImageThumb";
import { HistoryListText } from "./HistoryListText";

// Props 类型让组件的输入更清晰：数据在父组件中维护，列表只发出用户操作。
type HistoryListProps = {
  hasHistory: boolean;
  isKeyboardNavigating: boolean;
  items: HistoryListItem[];
  translations: AppTranslations["history"];
  onOpenItemPreview: (
    item: HistoryListItem,
    anchorTop: number,
    targetId: string,
    source: "focus" | "pointer",
  ) => void;
  onScheduleClosePreview: () => void;
  onSelectItem: (id: string) => void;
  showItemNumbers: boolean;
  selectedItemId?: string;
};

export function HistoryList({
  hasHistory,
  isKeyboardNavigating,
  items,
  translations,
  onOpenItemPreview,
  onScheduleClosePreview,
  onSelectItem,
  showItemNumbers,
  selectedItemId,
}: HistoryListProps) {
  if (items.length === 0) {
    // 同一个空状态组件根据 hasHistory 区分“没有记录”和“搜索无匹配”。
    return (
      <div className={ui.historyGroup}>
        <div className={ui.empty}>
          {hasHistory ? translations.noMatches : translations.empty}
        </div>
      </div>
    );
  }

  return (
    <div className={ui.historyGroup}>
      {items.map((item, index) => {
        const displayText = getHistoryListDisplayText(item);
        const targetId = serializeMainKeyboardNavigationTarget({
          itemId: item.id,
          kind: "history-item",
        });

        return (
          <div key={item.renderId}>
            {index > 0 && items[index - 1]?.isPinned && !item.isPinned ? (
              <div aria-hidden="true" className={ui.historyPinnedDivider} />
            ) : null}
            <div
              className={historyItemRow(
                item.kind,
                selectedItemId === item.id,
                isKeyboardNavigating,
              )}
              // key 不会作为 prop 传给子组件；它只给 React 的列表 diff 算法使用。
              onMouseLeave={onScheduleClosePreview}
            >
              <button
                className={historyItem(item.kind, showItemNumbers)}
                aria-label={
                  item.kind === "text" && item.secretType
                    ? translations.copySensitiveItemAriaLabel
                    : undefined
                }
                data-main-keyboard-target={targetId}
                onClick={() => onSelectItem(item.id)}
                onFocus={(event) => {
                  onOpenItemPreview(
                    item,
                    event.currentTarget.getBoundingClientRect().top,
                    targetId,
                    "focus",
                  );
                }}
                onPointerMove={(event) => {
                  onOpenItemPreview(
                    item,
                    event.currentTarget.getBoundingClientRect().top,
                    targetId,
                    "pointer",
                  );
                }}
                type="button"
              >
                {showItemNumbers ? (
                  <span className={ui.itemIndex}>{item.position}.</span>
                ) : null}
                {item.kind === "image" ? (
                  <span className={ui.itemThumbnailWrap}>
                    <ImageThumb
                      alt={displayText}
                      className={ui.itemThumbnail}
                      imagePath={item.imagePath}
                    />
                    <span className={ui.itemText}>{displayText}</span>
                  </span>
                ) : item.kind === "text" ? (
                  <HistoryListText
                    className={ui.itemText}
                    displayText={displayText}
                    isSensitive={item.secretType !== null}
                    sensitiveLabel={translations.sensitiveBadge}
                    text={item.text}
                  />
                ) : (
                  <span className={ui.itemText}>{displayText}</span>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
