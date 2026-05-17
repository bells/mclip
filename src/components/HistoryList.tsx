// 主历史列表：展示当前分组的前 10 条或搜索结果，并支持点击复制。

import type { AppTranslations } from "../i18n";
import type { HistoryListItem } from "../types";

type HistoryListProps = {
  hasHistory: boolean;
  items: HistoryListItem[];
  translations: AppTranslations["history"];
  onSelectItem: (text: string) => void;
  selectedItemId?: string;
};

export function HistoryList({
  hasHistory,
  items,
  translations,
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
        <button
          className={`app-item ${selectedItemId === item.id ? "is-selected" : ""}`}
          key={item.id}
          onClick={() => onSelectItem(item.text)}
          title={item.text}
          type="button"
        >
          <span className="app-item-index">{item.position}.</span>
          <span className="app-item-text">{item.text}</span>
        </button>
      ))}
    </div>
  );
}
