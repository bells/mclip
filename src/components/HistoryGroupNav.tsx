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
  return String(localPosition);
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

  if (archiveGroups.length === 0) {
    return null;
  }

  return (
    <div className="app-history-archive" onMouseLeave={onClosePreview}>
      <div className="app-history-archive-divider" />

      <div className="app-history-archive-list" aria-label="更早的剪贴板历史">
        {archiveGroups.map((group) => {
          const isActive = group.index === previewGroupIndex;
          const groupItems = isActive ? previewItems : [];

          return (
            <div className="app-history-archive-entry" key={group.index}>
              <button
                aria-expanded={isActive}
                aria-haspopup="menu"
                className={`app-history-archive-row ${isActive ? "is-active" : ""}`}
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

              {isActive && groupItems.length > 0 ? (
                <div className="app-history-preview-shell">
                  <div
                    aria-label={`历史分组 ${group.startPosition}-${group.endPosition}`}
                    className="app-history-preview"
                    role="menu"
                  >
                    <div className="app-history-preview-header">
                      <span className="app-history-preview-kicker">History Group</span>
                      <span className="app-history-preview-range">
                        {group.startPosition} - {group.endPosition}
                      </span>
                    </div>

                    <div className="app-history-preview-list">
                      {groupItems.map((item) => (
                        <button
                          className="app-history-preview-item"
                          key={item.id}
                          onClick={() => onSelectItem(item.text)}
                          title={item.text}
                          type="button"
                        >
                          <span className="app-history-preview-index">
                            {getLocalDisplayPosition(item, group)}.
                          </span>
                          <span className="app-history-preview-text">{item.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
