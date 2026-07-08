// 单条历史详情 preview：只负责展示一个历史项的完整内容和元信息。

import { getTranslations } from "../i18n";
import type { HistoryItemPreviewPayload } from "../types";
import { ui } from "../uiStyles";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { TrashIcon } from "./UiIcons";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryItemPreviewWindowProps = {
  preview: HistoryItemPreviewPayload;
  translations: HistoryTranslations;
  onDeleteItem: (id: string) => void;
  onPointerInside: () => void;
  onRequestClose: () => void;
};

export function HistoryItemPreviewWindow({
  preview,
  translations,
  onDeleteItem,
  onPointerInside,
  onRequestClose,
}: HistoryItemPreviewWindowProps) {
  return (
    <div
      className={ui.previewWindow}
      onMouseEnter={onPointerInside}
      onMouseMove={onPointerInside}
      onMouseLeave={onRequestClose}
    >
      <HistoryDetailPanel
        ariaLabel={translations.itemPreviewAriaLabel}
        headerAction={
          <button
            aria-label={translations.deleteItemAriaLabel}
            className={ui.historyDetailActionButton}
            onClick={(event) => {
              event.stopPropagation();
              onDeleteItem(preview.item.id);
            }}
            title={translations.deleteItemAriaLabel}
            type="button"
          >
            <TrashIcon className={ui.deleteIcon} />
          </button>
        }
        item={preview.item}
        language={preview.language}
        role="dialog"
        translations={translations}
      />
    </div>
  );
}
