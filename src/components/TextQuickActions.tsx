import { useEffect, useRef, useState } from "react";

import type {
  AppearanceTheme, AppLanguage, TextHistoryEntry, TextQuickActionSettings,
  TextTransformAction, TextTransformError,
} from "../types";
import { getTranslations } from "../i18n";
import { getApplicableTextTransformActions } from "../services/ipc/commands";
import { listenToSensitiveRevealReset } from "../services/ipc/events";
import { openTextQuickAction } from "../services/quickActions";
import { ui } from "../uiStyles";
import {
  filterEnabledTextQuickActions, hasEnabledTextQuickActions,
  TEXT_QUICK_ACTION_GROUP_BY_ACTION,
} from "../utils/textQuickActions";

type TextQuickActionsProps = {
  appearanceTheme: AppearanceTheme;
  isContentAvailable: boolean;
  item: TextHistoryEntry;
  language: AppLanguage;
  settings: TextQuickActionSettings;
};
type Discovery =
  | { status: "loading"; visible: boolean }
  | { status: "ready"; actions: TextTransformAction[] }
  | { status: "error" };

export function TextQuickActions({
  appearanceTheme, isContentAvailable, item, language, settings,
}: TextQuickActionsProps) {
  const t = getTranslations(language).quickAction;
  const [discovery, setDiscovery] = useState<Discovery>({ status: "loading", visible: false });
  const [retry, setRetry] = useState(0);
  const [pendingAction, setPendingAction] = useState<TextTransformAction | null>(null);
  const [errorCode, setErrorCode] = useState<TextTransformError["code"] | null>(null);
  const requestRevisionRef = useRef(0);
  const runningRef = useRef(false);
  const actionRevisionRef = useRef(0);
  const { json, base64, urlComponent } = settings;

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenToSensitiveRevealReset(() => {
      actionRevisionRef.current += 1;
      runningRef.current = false;
      setPendingAction(null);
      setErrorCode(null);
    }).then((unsubscribe) => {
      if (active) unlisten = unsubscribe;
      else unsubscribe();
    });
    return () => { active = false; unlisten?.(); };
  }, []);

  useEffect(() => {
    const revision = ++requestRevisionRef.current;
    actionRevisionRef.current += 1;
    runningRef.current = false;
    setPendingAction(null);
    setErrorCode(null);
    setDiscovery({ status: "loading", visible: false });
    if (!isContentAvailable || !(json || base64 || urlComponent)) return;
    const timer = window.setTimeout(() => {
      if (revision === requestRevisionRef.current) {
        setDiscovery({ status: "loading", visible: true });
      }
    }, 150);
    void getApplicableTextTransformActions(item.text).then((actions) => {
      if (revision === requestRevisionRef.current) {
        setDiscovery({ status: "ready", actions: filterEnabledTextQuickActions(actions, { json, base64, urlComponent }) });
      }
    }).catch(() => {
      if (revision === requestRevisionRef.current) setDiscovery({ status: "error" });
    }).finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      requestRevisionRef.current += 1;
      actionRevisionRef.current += 1;
    };
  }, [isContentAvailable, item.id, item.text, json, base64, urlComponent, retry, appearanceTheme, language]);

  const runAction = async (action: TextTransformAction) => {
    if (runningRef.current) return;
    runningRef.current = true;
    const revision = actionRevisionRef.current;
    setPendingAction(action);
    setErrorCode(null);
    try {
      await openTextQuickAction(
        { action, appearanceTheme, item, language },
        () => revision === actionRevisionRef.current,
      );
    } catch (error: unknown) {
      if (revision === actionRevisionRef.current) {
        const code = (error as Partial<TextTransformError>)?.code;
        setErrorCode(code && code in t.errorLabels ? code : "workerFailed");
      }
    } finally {
      if (revision === actionRevisionRef.current) {
        runningRef.current = false;
        setPendingAction(null);
      }
    }
  };

  if (!hasEnabledTextQuickActions(settings)) return null;
  if (!isContentAvailable) return <p className={ui.quickActionHint}>{t.revealRequired}</p>;
  if (discovery.status === "loading") {
    return discovery.visible ? <p className={ui.quickActionHint} role="status">{t.loading}</p> : null;
  }
  if (discovery.status === "error") {
    return <div className={ui.quickActionSection}>
      <p className={ui.quickActionError} role="status">{t.loadError}</p>
      <button className={ui.quickActionChip} onClick={() => setRetry((value) => value + 1)} type="button">{t.retry}</button>
    </div>;
  }
  if (discovery.actions.length === 0) return <p className={ui.quickActionHint}>{t.empty}</p>;

  return (
    <div className={ui.quickActionSection}>
      <span className={ui.quickActionSectionLabel}>{t.actionsLabel}</span>
      <div className={ui.quickActionGrid}>
        {(["json", "base64", "urlComponent"] as const).map((group) => {
          const actions = discovery.actions.filter((action) => TEXT_QUICK_ACTION_GROUP_BY_ACTION[action] === group);
          if (!actions.length) return null;
          return <div aria-label={t.groupLabels[group]} className={ui.quickActionRow} key={group} role="group">
            <span className={ui.quickActionGroupLabel}>{t.groupLabels[group]}</span>
            {actions.map((action) => <button
              aria-busy={pendingAction === action}
              aria-label={t.actionLabels[action]}
              className={ui.quickActionChip}
              disabled={pendingAction !== null}
              key={action}
              onClick={() => void runAction(action)}
              type="button"
            >{pendingAction === action ? t.running : t.shortActionLabels[action]}</button>)}
          </div>;
        })}
      </div>
      {errorCode ? <p className={ui.quickActionError} role="status">{t.errorLabels[errorCode]}</p> : null}
    </div>
  );
}
