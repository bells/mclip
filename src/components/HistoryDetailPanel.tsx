// 通用历史详情面板：单条详情 preview 和分组 hover 详情共用同一套三段式结构。

import { useEffect, useState, type ReactNode } from "react";

import { getTranslations } from "../i18n";
import type {
  AppLanguage,
  AppearanceTheme,
  HistoryListItem,
  SensitiveHistoryRevealErrorCode,
} from "../types";
import { ui } from "../uiStyles";
import { resolveAppLanguage } from "../utils/language";
import { revealSensitiveHistoryText } from "../services/ipc/commands";
import { listenToSensitiveRevealReset } from "../services/ipc/events";
import {
  isSensitiveTextMasked,
  normalizeSensitiveHistoryRevealError,
} from "../utils/sensitiveContent";
import { HistoryPreviewDetailContent } from "./HistoryPreviewDetailContent";
import { TextQuickActions } from "./TextQuickActions";

type HistoryTranslations = ReturnType<typeof getTranslations>["history"];

type HistoryDetailPanelProps = {
  ariaLabel: string;
  appearanceTheme: AppearanceTheme;
  item: HistoryListItem;
  language: AppLanguage;
  translations: HistoryTranslations;
  className?: string;
  draggableHeader?: boolean;
  headerAction?: ReactNode;
  onSensitiveItemStale?: () => void;
  performanceInteractionId?: string | null;
  presentation?: "compact" | "viewer";
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
  appearanceTheme,
  item,
  language,
  translations,
  className = "",
  draggableHeader = false,
  headerAction,
  onSensitiveItemStale,
  performanceInteractionId = null,
  presentation = "compact",
  role = "dialog",
}: HistoryDetailPanelProps) {
  const [revealedText, setRevealedText] = useState<{
    item: HistoryListItem;
    text: string;
  } | null>(null);
  const [revealError, setRevealError] =
    useState<SensitiveHistoryRevealErrorCode | null>(null);
  const isMaskedSensitiveText = isSensitiveTextMasked(item);
  const isRevealed = revealedText?.item === item;
  const displayItem =
    isRevealed && item.kind === "text"
      ? {
          ...item,
          displayText: revealedText.text,
          text: revealedText.text,
        }
      : item;

  useEffect(() => {
    setRevealedText(null);
    setRevealError(null);
  }, [item]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenToSensitiveRevealReset(() => {
      setRevealedText(null);
      setRevealError(null);
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });
    return () => unlisten?.();
  }, []);

  const toggleSensitiveReveal = async () => {
    if (isRevealed) {
      setRevealedText(null);
      return;
    }

    setRevealError(null);
    try {
      const text = await revealSensitiveHistoryText(item.id);
      setRevealedText({ item, text });
    } catch (error: unknown) {
      const revealCommandError = normalizeSensitiveHistoryRevealError(error);
      setRevealError(revealCommandError.code);
      if (
        revealCommandError.code === "itemNotFound" ||
        revealCommandError.code === "classificationStale"
      ) {
        onSensitiveItemStale?.();
      }
    }
  };
  const revealErrorMessage =
    revealError === "itemNotFound"
      ? translations.revealSensitiveItemNotFound
      : revealError === "classificationStale"
        ? translations.revealSensitiveClassificationStale
        : translations.revealSensitiveHistoryUnavailable;
  const panelClassName = [ui.historyPreview, ui.historyDetailPreview, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div aria-label={ariaLabel} className={panelClassName} role={role}>
      <div
        className={ui.historyPreviewHeader}
        data-dialog-drag-region={draggableHeader ? true : undefined}
      >
        <span className={ui.historyPreviewKicker}>
          {translations.itemPreviewKicker}
        </span>
        <span className={ui.historyPreviewHeaderActions}>
          {isMaskedSensitiveText ? (
            <button
              aria-label={
                isRevealed
                  ? translations.hideSensitiveAriaLabel
                  : translations.revealSensitiveAriaLabel
              }
              className={ui.historySensitiveAction}
              onClick={() => void toggleSensitiveReveal()}
              type="button"
            >
              {isRevealed
                ? translations.hideSensitiveAction
                : translations.revealSensitiveAction}
            </button>
          ) : null}
          {headerAction}
          <span className={ui.historyPreviewRange}>
            {translations.kindLabels[item.kind]} #{item.position}
          </span>
        </span>
      </div>

      <div className={ui.historyDetailBody}>
        <div className={ui.historyDetailContentRegion}>
          <HistoryPreviewDetailContent
            item={displayItem}
            performanceInteractionId={performanceInteractionId}
            presentation={presentation}
            translations={translations}
          />
          {displayItem.kind === "text" ? (
            <TextQuickActions
              appearanceTheme={appearanceTheme}
              isContentAvailable={!isSensitiveTextMasked(displayItem)}
              item={displayItem}
              language={language}
            />
          ) : null}
        </div>

        {revealError ? (
          <div className={ui.historySensitiveError} role="status">
            {revealErrorMessage}
          </div>
        ) : null}

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
