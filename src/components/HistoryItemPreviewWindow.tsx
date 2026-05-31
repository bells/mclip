// 单条历史详情 preview：只负责展示一个历史项的完整内容和元信息。

import { getTranslations } from "../i18n";
import type { HistoryItemPreviewPayload } from "../types";
import { HistoryDetailPanel } from "./HistoryDetailPanel";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryItemPreviewWindowProps = {
  preview: HistoryItemPreviewPayload;
  translations: HistoryTranslations;
  onPointerInside: () => void;
  onRequestClose: () => void;
};

export function HistoryItemPreviewWindow({
  preview,
  translations,
  onPointerInside,
  onRequestClose,
}: HistoryItemPreviewWindowProps) {
  return (
    <div
      className="history-preview-window"
      onMouseEnter={onPointerInside}
      onMouseMove={onPointerInside}
      onMouseLeave={onRequestClose}
    >
      <HistoryDetailPanel
        ariaLabel={translations.itemPreviewAriaLabel}
        item={preview.item}
        language={preview.language}
        role="dialog"
        translations={translations}
      />
    </div>
  );
}
