// 单条历史详情 preview：只负责展示一个历史项的完整内容和元信息。

import { getTranslations } from "../i18n";
import type { HistoryItemPreviewPayload } from "../types";
import { ui } from "../uiStyles";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { HistoryDetailDeleteButton } from "./HistoryDetailDeleteButton";
import { HistoryDetailFullscreenButton } from "./HistoryDetailFullscreenButton";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryItemPreviewWindowProps = {
  preview: HistoryItemPreviewPayload;
  translations: HistoryTranslations;
  onDeleteItem: (id: string) => void;
  onViewFullscreen: () => Promise<void>;
  onPointerInside: () => void;
  onRequestClose: () => void;
};

export function HistoryItemPreviewWindow({
  preview,
  translations,
  onDeleteItem,
  onViewFullscreen,
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
          <>
            {preview.item.kind === "image" ? (
              <HistoryDetailFullscreenButton
                label={translations.viewImageFullscreenAriaLabel}
                onOpen={onViewFullscreen}
              />
            ) : null}
            <HistoryDetailDeleteButton
              label={translations.deleteItemAriaLabel}
              onDelete={() => onDeleteItem(preview.item.id)}
            />
          </>
        }
        item={preview.item}
        language={preview.language}
        performanceInteractionId={preview.performanceInteractionId}
        role="dialog"
        translations={translations}
      />
    </div>
  );
}
