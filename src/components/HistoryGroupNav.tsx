// 历史分组入口：主窗口只显示分组按钮，具体预览由独立 preview 窗口承载。

import type { AppTranslations } from "../i18n";
import type { HistoryGroupInfo } from "../types";
import { archiveRow, ui } from "../uiStyles";
import { serializeMainKeyboardNavigationTarget } from "../utils/keyboardNavigation";
import { ChevronRightIcon, FolderIcon } from "./UiIcons";

// 主列表显示最新一组，后续分组通过这些入口打开右侧 preview 窗口。
type HistoryGroupNavProps = {
  activeGroupIndex: number | null;
  groups: HistoryGroupInfo[];
  previewGroupIndex: number | null;
  translations: AppTranslations["history"];
  onOpenPreview: (
    groupIndex: number,
    anchorTop: number,
    targetId: string,
    source: "focus" | "pointer",
  ) => void;
  onScheduleClosePreview: () => void;
};

export function HistoryGroupNav({
  activeGroupIndex,
  groups,
  previewGroupIndex,
  translations,
  onOpenPreview,
  onScheduleClosePreview,
}: HistoryGroupNavProps) {
  // slice(1) 会返回一个新数组，不会修改原来的 groups；第 0 组已经在主列表中显示。
  const archiveGroups = groups.slice(1);

  if (archiveGroups.length === 0) {
    // React 组件返回 null 表示什么都不渲染。
    return null;
  }

  const openPreview = (
    groupIndex: number,
    element: HTMLButtonElement,
    targetId: string,
    source: "focus" | "pointer",
  ) => {
    // anchorTop 是当前分组按钮在主窗口内的顶部位置，Rust 用它对齐 preview 窗口。
    onOpenPreview(groupIndex, element.getBoundingClientRect().top, targetId, source);
  };

  return (
    <div className={ui.archive} onMouseLeave={onScheduleClosePreview}>
      <div className={ui.archiveDivider} />

      <div
        className={ui.archiveList}
        aria-label={translations.groupAriaLabel}
      >
        {archiveGroups.map((group) => {
          const isActive = group.index === activeGroupIndex;
          const isExpanded = group.index === previewGroupIndex;
          const targetId = serializeMainKeyboardNavigationTarget({
            groupIndex: group.index,
            kind: "history-group",
          });

          // map 渲染列表时必须给稳定的 key，React 用它识别哪些节点需要复用。
          return (
            <div className={ui.archiveEntry} key={group.index}>
              <button
                aria-expanded={isExpanded}
                aria-haspopup="menu"
                className={archiveRow(isActive)}
                data-main-keyboard-target={targetId}
                onClick={(event) =>
                  openPreview(group.index, event.currentTarget, targetId, "focus")
                }
                onFocus={(event) =>
                  openPreview(group.index, event.currentTarget, targetId, "focus")
                }
                onPointerMove={(event) =>
                  openPreview(group.index, event.currentTarget, targetId, "pointer")
                }
                type="button"
              >
                <FolderIcon className={ui.archiveFolderIcon} />
                <span className={ui.archiveLabel}>
                  {group.startPosition} - {group.endPosition}
                </span>
                <ChevronRightIcon className={ui.archiveChevron} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
