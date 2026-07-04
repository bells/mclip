// 主历史列表：展示当前分组的前 10 条或搜索结果，并支持点击复制。

import type { AppTranslations } from "../i18n";
import type { HistoryListItem } from "../types";
import { historyDeleteButton, historyItem, historyItemRow, ui } from "../uiStyles";
import {
  getTextHistoryAffordance,
  type HistoryTextAffordance,
} from "../utils/historyAffordance";
import { getHistoryListDisplayText } from "../utils/history";
import { serializeMainKeyboardNavigationTarget } from "../utils/keyboardNavigation";
import { ImageThumb } from "./ImageThumb";
import { TrashIcon } from "./UiIcons";

// Props 类型让组件的输入更清晰：数据在父组件中维护，列表只发出用户操作。
type HistoryListProps = {
  hasHistory: boolean;
  isKeyboardNavigating: boolean;
  items: HistoryListItem[];
  translations: AppTranslations["history"];
  onDeleteItem: (id: string) => void;
  onOpenItemPreview: (
    item: HistoryListItem,
    anchorTop: number,
    targetId: string,
  ) => void;
  onScheduleClosePreview: () => void;
  onSelectItem: (id: string) => void;
  showItemNumbers: boolean;
  selectedItemId?: string;
};

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

export function HistoryList({
  hasHistory,
  isKeyboardNavigating,
  items,
  translations,
  onDeleteItem,
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
        const textAffordance =
          item.kind === "text" ? getTextHistoryAffordance(item.text) : null;
        const targetId = serializeMainKeyboardNavigationTarget({
          index,
          kind: "history-item",
        });

        return (
          <div
            className={historyItemRow(
              selectedItemId === item.id,
              isKeyboardNavigating,
            )}
            // key 不会作为 prop 传给子组件；它只给 React 的列表 diff 算法使用。
            key={item.renderId}
            onMouseEnter={(event) => {
              // currentTarget 是绑定事件的这行元素，用它测量位置比 target 更稳定。
              onOpenItemPreview(
                item,
                event.currentTarget.getBoundingClientRect().top,
                targetId,
              );
            }}
            onMouseLeave={onScheduleClosePreview}
            >
              <button
              className={historyItem(showItemNumbers)}
              data-main-keyboard-target={targetId}
              onClick={() => onSelectItem(item.id)}
              onFocus={(event) => {
                onOpenItemPreview(
                  item,
                  event.currentTarget.getBoundingClientRect().top,
                  targetId,
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
              ) : (
                <span
                  className={`${ui.itemText} ${
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
              className={historyDeleteButton(selectedItemId === item.id)}
              onClick={(event) => {
                // 阻止删除按钮的点击继续冒泡到外层行，避免同时触发选择/复制。
                event.stopPropagation();
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
  );
}
