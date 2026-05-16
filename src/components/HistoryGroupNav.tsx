import type { HistoryGroupInfo, HistoryListItem } from "../types";

type HistoryGroupNavProps = {
  groups: HistoryGroupInfo[];
  previewGroupIndex: number | null;
  previewItems: HistoryListItem[];
  onClosePreview: () => void;
  onOpenPreview: (groupIndex: number) => void;
  onSelectItem: (text: string) => void;
};

function getLocalDisplayPosition(item: HistoryListItem, group: HistoryGroupInfo) {
  const localPosition = item.position - group.startPosition + 1;
  return localPosition === 10 ? "0" : String(localPosition);
}

export function HistoryGroupNav({
  groups,
  previewGroupIndex,
  previewItems,
  onClosePreview,
  onOpenPreview,
  onSelectItem,
}: HistoryGroupNavProps) {
  const archiveGroups = groups.slice(1);
  const previewGroup = groups.find((group) => group.index === previewGroupIndex);

  if (archiveGroups.length === 0) {
    return null;
  }

  return (
    <div className="app-history-archive" onMouseLeave={onClosePreview}>
      <div className="app-history-archive-divider" />

      <div className="app-history-archive-list" aria-label="更早的剪贴板历史">
        {archiveGroups.map((group) => {
          const isActive = group.index === previewGroupIndex;

          return (
            <button
              aria-expanded={isActive}
              className={`app-history-archive-row ${isActive ? "is-active" : ""}`}
              key={group.index}
              onClick={() => onOpenPreview(group.index)}
              onFocus={() => onOpenPreview(group.index)}
              onMouseEnter={() => onOpenPreview(group.index)}
              type="button"
            >
              <span className="app-history-folder-icon" aria-hidden="true" />
              <span className="app-history-archive-label">
                {group.startPosition} - {group.endPosition}
              </span>
              <span className="app-history-archive-chevron" aria-hidden="true">
                &gt;
              </span>
            </button>
          );
        })}
      </div>

      {previewGroup && previewItems.length > 0 ? (
        <div className="app-history-preview" aria-label="历史分组预览">
          {previewItems.map((item) => (
            <button
              className="app-history-preview-item"
              key={item.id}
              onClick={() => onSelectItem(item.text)}
              title={item.text}
              type="button"
            >
              <span className="app-history-preview-index">
                {getLocalDisplayPosition(item, previewGroup)}.
              </span>
              <span className="app-history-preview-text">{item.text}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
