import type { HistoryListItem } from "../types";

type HistoryListProps = {
  hasHistory: boolean;
  items: HistoryListItem[];
  onSelectItem: (text: string) => void;
  selectedItemId?: string;
};

export function HistoryList({
  hasHistory,
  items,
  onSelectItem,
  selectedItemId,
}: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="app-history-group">
        <div className="app-empty">
          {hasHistory ? "没有匹配的结果" : "等待复制内容..."}
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
