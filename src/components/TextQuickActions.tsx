import { useEffect, useRef, useState } from "react";

import type {
  AppearanceTheme,
  AppLanguage,
  TextHistoryEntry,
  TextTransformAction,
  TextTransformError,
} from "../types";
import { getTranslations } from "../i18n";
import { getApplicableTextTransformActions } from "../services/ipc/commands";
import { openTextQuickAction } from "../services/quickActions";
import { ui } from "../uiStyles";

type TextQuickActionsProps = {
  appearanceTheme: AppearanceTheme;
  isContentAvailable: boolean;
  item: TextHistoryEntry;
  language: AppLanguage;
};

export function TextQuickActions({
  appearanceTheme,
  isContentAvailable,
  item,
  language,
}: TextQuickActionsProps) {
  const t = getTranslations(language).quickAction;
  const [actions, setActions] = useState<TextTransformAction[]>([]);
  const [pendingAction, setPendingAction] =
    useState<TextTransformAction | null>(null);
  const [errorCode, setErrorCode] =
    useState<TextTransformError["code"] | null>(null);
  const requestRevisionRef = useRef(0);

  useEffect(() => {
    const revision = ++requestRevisionRef.current;
    setActions([]);
    setPendingAction(null);
    setErrorCode(null);
    if (!isContentAvailable) {
      return;
    }

    void getApplicableTextTransformActions(item.text)
      .then((nextActions) => {
        if (revision === requestRevisionRef.current) {
          setActions(nextActions);
        }
      })
      .catch(() => {
        if (revision === requestRevisionRef.current) {
          setErrorCode("workerFailed");
        }
      });
    return () => {
      requestRevisionRef.current += 1;
    };
  }, [isContentAvailable, item.id, item.text]);

  const runAction = async (action: TextTransformAction) => {
    const revision = ++requestRevisionRef.current;
    setPendingAction(action);
    setErrorCode(null);
    try {
      await openTextQuickAction(
        { action, appearanceTheme, item, language },
        () => revision === requestRevisionRef.current,
      );
    } catch (error: unknown) {
      if (revision === requestRevisionRef.current) {
        const code = (error as Partial<TextTransformError>)?.code;
        setErrorCode(code ?? "workerFailed");
      }
    } finally {
      if (revision === requestRevisionRef.current) {
        setPendingAction(null);
      }
    }
  };

  if (!isContentAvailable) {
    return <p className={ui.quickActionHint}>{t.revealRequired}</p>;
  }

  return (
    <div className={ui.quickActionSection}>
      <span className={ui.quickActionSectionLabel}>{t.actionsLabel}</span>
      <div className={ui.quickActionGrid}>
        {actions.map((action) => (
          <button
            aria-busy={pendingAction === action}
            className={ui.quickActionChip}
            disabled={pendingAction !== null}
            key={action}
            onClick={() => void runAction(action)}
            type="button"
          >
            {pendingAction === action ? t.running : t.actionLabels[action]}
          </button>
        ))}
      </div>
      {errorCode ? (
        <p className={ui.quickActionError} role="status">
          {t.errorLabels[errorCode]}
        </p>
      ) : null}
    </div>
  );
}
