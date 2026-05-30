// 单条历史详情 preview：只负责展示一个历史项的完整内容和元信息。

import { getTranslations } from "../i18n";
import type { HistoryItemPreviewPayload } from "../types";
import { HistoryPreviewDetailContent } from "./HistoryPreviewDetailContent";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryItemPreviewWindowProps = {
  isDetailMetaOpen: boolean;
  preview: HistoryItemPreviewPayload;
  translations: HistoryTranslations;
  onPointerInside: () => void;
  onRequestClose: () => void;
  onToggleDetailMeta: () => void;
};

function formatHistoryTimestamp(
  timestamp: number,
  language: HistoryItemPreviewPayload["language"],
) {
  // language 的类型直接复用 payload 字段，避免这里和 types.ts 里的定义漂移。
  const locale = language === "zhCn" ? "zh-CN" : "en-US";

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

export function HistoryItemPreviewWindow({
  isDetailMetaOpen,
  preview,
  translations,
  onPointerInside,
  onRequestClose,
  onToggleDetailMeta,
}: HistoryItemPreviewWindowProps) {
  return (
    <div
      className="history-preview-window"
      onMouseEnter={onPointerInside}
      onMouseMove={onPointerInside}
      onMouseLeave={onRequestClose}
    >
      <div
        aria-label={translations.itemPreviewAriaLabel}
        className="app-history-preview app-history-detail-preview"
        role="dialog"
      >
        <div className="app-history-preview-header">
          <span className="app-history-preview-kicker">
            {translations.itemPreviewKicker}
          </span>
          <span className="app-history-preview-range">
            {translations.kindLabels[preview.item.kind]} #{preview.item.position}
          </span>
        </div>

        <div className="app-history-detail-body">
          <HistoryPreviewDetailContent item={preview.item} translations={translations} />

          <button
            className={`app-detail-meta-toggle ${isDetailMetaOpen ? "is-open" : ""}`}
            onClick={onToggleDetailMeta}
            type="button"
          >
            <span className="app-detail-meta-toggle-label">
              {translations.detailMetaToggle}
            </span>
            <span className="app-detail-meta-toggle-chevron" aria-hidden="true" />
          </button>

          {isDetailMetaOpen ? (
            <dl className="app-history-detail-meta">
              <div>
                <dt>{translations.sourceAppLabel}</dt>
                <dd>{preview.item.sourceApp ?? translations.sourceAppFallback}</dd>
              </div>
              <div>
                <dt>{translations.firstCopiedTimeLabel}</dt>
                <dd>
                  {formatHistoryTimestamp(preview.item.firstCopiedAt, preview.language)}
                </dd>
              </div>
              <div>
                <dt>{translations.lastCopiedTimeLabel}</dt>
                <dd>
                  {formatHistoryTimestamp(preview.item.lastCopiedAt, preview.language)}
                </dd>
              </div>
              <div>
                <dt>{translations.copyCountLabel}</dt>
                <dd>{preview.item.copyCount}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>
    </div>
  );
}
