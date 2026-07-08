// 通用历史详情面板：单条详情 preview 和分组 hover 详情共用同一套三段式结构。

import type { ReactNode } from "react";

import { getTranslations } from "../i18n";
import type { AppLanguage, HistoryListItem } from "../types";
import { ui } from "../uiStyles";
import { resolveAppLanguage } from "../utils/language";
import { HistoryPreviewDetailContent } from "./HistoryPreviewDetailContent";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryDetailPanelProps = {
  ariaLabel: string;
  item: HistoryListItem;
  language: AppLanguage;
  translations: HistoryTranslations;
  className?: string;
  headerAction?: ReactNode;
  role?: "dialog" | "region";
};

function formatHistoryTimestamp(timestamp: number, language: AppLanguage) {
  const locale = resolveAppLanguage(language) === "zhCn" ? "zh-CN" : "en-US";

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
  headerAction,
  role = "dialog",
}: HistoryDetailPanelProps) {
  const panelClassName = [ui.historyPreview, ui.historyDetailPreview, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div aria-label={ariaLabel} className={panelClassName} role={role}>
      <div className={ui.historyPreviewHeader}>
        <span className={ui.historyPreviewKicker}>
          {translations.itemPreviewKicker}
        </span>
        <span className={ui.historyPreviewHeaderActions}>
          {headerAction}
          <span className={ui.historyPreviewRange}>
            {translations.kindLabels[item.kind]} #{item.position}
          </span>
        </span>
      </div>

      <div className={ui.historyDetailBody}>
        <div className={ui.historyDetailContentRegion}>
          <HistoryPreviewDetailContent item={item} translations={translations} />
        </div>

        <dl className={ui.historyDetailMeta}>
          <div className={ui.historyDetailMetaItem}>
            <dt className={ui.historyDetailMetaLabel}>{translations.sourceAppLabel}</dt>
            <dd className={ui.historyDetailMetaValue}>
              {item.sourceApp ?? translations.sourceAppFallback}
            </dd>
          </div>
          <div className={ui.historyDetailMetaItem}>
            <dt className={ui.historyDetailMetaLabel}>{translations.firstCopiedTimeLabel}</dt>
            <dd className={ui.historyDetailMetaValue}>
              {formatHistoryTimestamp(item.firstCopiedAt, language)}
            </dd>
          </div>
          <div className={ui.historyDetailMetaItem}>
            <dt className={ui.historyDetailMetaLabel}>{translations.lastCopiedTimeLabel}</dt>
            <dd className={ui.historyDetailMetaValue}>
              {formatHistoryTimestamp(item.lastCopiedAt, language)}
            </dd>
          </div>
          <div className={ui.historyDetailMetaItem}>
            <dt className={ui.historyDetailMetaLabel}>{translations.copyCountLabel}</dt>
            <dd className={ui.historyDetailMetaValue}>{item.copyCount}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
