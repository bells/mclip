// 单条历史详情 preview：只负责展示一个历史项的完整内容和元信息。

import { getTranslations } from "../i18n";
import type { HistoryItemPreviewPayload } from "../types";
import { ui } from "../uiStyles";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { HistoryDetailDeleteButton } from "./HistoryDetailDeleteButton";
import { HistoryDetailFullscreenButton } from "./HistoryDetailFullscreenButton";
import { HistoryPinButton } from "./HistoryPinButton";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryItemPreviewWindowProps = {
  preview: HistoryItemPreviewPayload;
  translations: HistoryTranslations;
  onDeleteItem: (id: string) => void;
  onViewFullscreen: () => Promise<void>;
  onPointerInside: () => void;
  onTogglePinned: (id: string) => void;
  onRequestClose: () => void;
  onSensitiveItemStale: () => void;
};

export function HistoryItemPreviewWindow({
  preview,
  translations,
  onDeleteItem,
  onViewFullscreen,
  onPointerInside,
  onTogglePinned,
  onRequestClose,
  onSensitiveItemStale,
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
        appearanceTheme={preview.appearanceTheme}
        headerAction={
          <>
            <HistoryPinButton
              isPinned={preview.item.isPinned}
              label={preview.item.isPinned ? translations.unpinItemAriaLabel : translations.pinItemAriaLabel}
              onToggle={() => onTogglePinned(preview.item.id)}
            />
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
        onSensitiveItemStale={onSensitiveItemStale}
        performanceInteractionId={preview.performanceInteractionId}
        role="dialog"
        translations={translations}
      />
    </div>
  );
}
