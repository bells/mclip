// 主历史列表：展示当前分组的前 10 条或搜索结果，并支持点击复制。

import type { AppTranslations } from "../i18n";
import type { HistoryListItem } from "../types";
import { ImageThumb } from "./ImageThumb";

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
          key={item.renderId}
          onMouseEnter={(event) => {
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
