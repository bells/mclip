// 主历史列表：展示当前分组的前 10 条或搜索结果，并支持点击复制。

import type { AppTranslations } from "../i18n";
import type { HistoryListItem } from "../types";
import { ImageThumb } from "./ImageThumb";

// Props 类型让组件的输入更清晰：数据在父组件中维护，列表只发出用户操作。
type HistoryListProps = {
  hasHistory: boolean;
  items: HistoryListItem[];
  translations: AppTranslations["history"];
  onDeleteItem: (id: string) => void;
  onOpenItemPreview: (item: HistoryListItem, anchorTop: number) => void;
  onScheduleClosePreview: () => void;
  onSelectItem: (id: string) => void;
  selectedItemId?: string;
};

export function HistoryList({
  hasHistory,
  items,
  translations,
  onDeleteItem,
  onOpenItemPreview,
  onScheduleClosePreview,
  onSelectItem,
  selectedItemId,
}: HistoryListProps) {
  if (items.length === 0) {
    // 同一个空状态组件根据 hasHistory 区分“没有记录”和“搜索无匹配”。
    return (
      <div className="app-history-group">
        <div className="app-empty">
          {hasHistory ? translations.noMatches : translations.empty}
        </div>
      </div>
    );
  }

  return (
    <div className="app-history-group">
      {items.map((item) => (
        <div
          className={`app-item-row ${selectedItemId === item.id ? "is-selected" : ""}`}
          // key 不会作为 prop 传给子组件；它只给 React 的列表 diff 算法使用。
          key={item.renderId}
          onMouseEnter={(event) => {
            // currentTarget 是绑定事件的这行元素，用它测量位置比 target 更稳定。
            onOpenItemPreview(item, event.currentTarget.getBoundingClientRect().top);
          }}
          onMouseLeave={onScheduleClosePreview}
        >
          <button
            className="app-item"
            onClick={() => onSelectItem(item.id)}
            type="button"
          >
            <span className="app-item-index">{item.position}.</span>
            {item.kind === "image" ? (
              <span className="app-item-thumbnail-wrap">
                <ImageThumb
                  alt={item.displayText}
                  className="app-item-thumbnail"
                  imagePath={item.imagePath}
                />
                <span className="app-item-text">{item.displayText}</span>
              </span>
            ) : (
              <span className="app-item-text">{item.displayText}</span>
            )}
          </button>
          <button
            aria-label={translations.deleteItemAriaLabel}
            className="app-item-delete"
            onClick={(event) => {
              // 阻止删除按钮的点击继续冒泡到外层行，避免同时触发选择/复制。
              event.stopPropagation();
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
  );
}
