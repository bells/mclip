// 历史分组入口：主窗口只显示分组按钮，具体预览由独立 preview 窗口承载。

import type { AppTranslations } from "../i18n";
import type { HistoryGroupInfo } from "../types";

type HistoryGroupNavProps = {
  groups: HistoryGroupInfo[];
  previewGroupIndex: number | null;
  translations: AppTranslations["history"];
  onOpenPreview: (groupIndex: number, anchorTop: number) => void;
  onScheduleClosePreview: () => void;
};

export function HistoryGroupNav({
  groups,
  previewGroupIndex,
  translations,
  onOpenPreview,
  onScheduleClosePreview,
}: HistoryGroupNavProps) {
  const archiveGroups = groups.slice(1);

  if (archiveGroups.length === 0) {
    return null;
  }

  const openPreview = (
    groupIndex: number,
    element: HTMLButtonElement,
  ) => {
    // anchorTop 是当前分组按钮在主窗口内的顶部位置，Rust 用它对齐 preview 窗口。
    onOpenPreview(groupIndex, element.getBoundingClientRect().top);
  };

  return (
    <div className="app-history-archive" onMouseLeave={onScheduleClosePreview}>
      <div className="app-history-archive-divider" />

      <div className="app-history-archive-list" aria-label={translations.groupAriaLabel}>
        {archiveGroups.map((group) => {
          const isActive = group.index === previewGroupIndex;

          return (
            <div className="app-history-archive-entry" key={group.index}>
              <button
                aria-expanded={isActive}
                aria-haspopup="menu"
                className={`app-history-archive-row ${isActive ? "is-active" : ""}`}
                onClick={(event) => openPreview(group.index, event.currentTarget)}
                onFocus={(event) => openPreview(group.index, event.currentTarget)}
                onMouseEnter={(event) => openPreview(group.index, event.currentTarget)}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
