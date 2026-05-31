// 通用历史详情面板：单条详情 preview 和分组 hover 详情共用同一套三段式结构。

import { getTranslations } from "../i18n";
import type { AppLanguage, HistoryListItem } from "../types";
import { HistoryPreviewDetailContent } from "./HistoryPreviewDetailContent";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryDetailPanelProps = {
  ariaLabel: string;
  item: HistoryListItem;
  language: AppLanguage;
  translations: HistoryTranslations;
  className?: string;
  role?: "dialog" | "region";
};

function formatHistoryTimestamp(timestamp: number, language: AppLanguage) {
  const locale = language === "zhCn" ? "zh-CN" : "en-US";

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

export function HistoryDetailPanel({
  ariaLabel,
  item,
  language,
  translations,
  className = "",
  role = "dialog",
}: HistoryDetailPanelProps) {
  const panelClassName = `app-history-preview app-history-detail-preview ${className}`.trim();

  return (
    <div aria-label={ariaLabel} className={panelClassName} role={role}>
      <div className="app-history-preview-header">
        <span className="app-history-preview-kicker">
          {translations.itemPreviewKicker}
        </span>
        <span className="app-history-preview-range">
          {translations.kindLabels[item.kind]} #{item.position}
        </span>
      </div>

      <div className="app-history-detail-body">
        <div className="app-history-detail-content-region">
          <HistoryPreviewDetailContent item={item} translations={translations} />
        </div>

        <dl className="app-history-detail-meta">
          <div>
            <dt>{translations.sourceAppLabel}</dt>
            <dd>{item.sourceApp ?? translations.sourceAppFallback}</dd>
          </div>
          <div>
            <dt>{translations.firstCopiedTimeLabel}</dt>
            <dd>{formatHistoryTimestamp(item.firstCopiedAt, language)}</dd>
          </div>
          <div>
            <dt>{translations.lastCopiedTimeLabel}</dt>
            <dd>{formatHistoryTimestamp(item.lastCopiedAt, language)}</dd>
          </div>
          <div>
            <dt>{translations.copyCountLabel}</dt>
            <dd>{item.copyCount}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
