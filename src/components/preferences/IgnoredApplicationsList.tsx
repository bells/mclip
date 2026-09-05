import { useRef, useState } from "react";

import { MAX_IGNORED_SOURCE_APP_COUNT } from "../../constants";
import { useIgnoredSourceApps } from "../../hooks/useIgnoredSourceApps";
import type { AppTranslations } from "../../i18n";
import { ui } from "../../uiStyles";
import type { PreferenceFeedbackState } from "./preferenceSaveController";

interface IgnoredApplicationsListProps {
  canAdd: boolean;
  feedback?: PreferenceFeedbackState;
  identifiers: string[];
  onChange: (ids: string[]) => void;
  translations: AppTranslations["preferences"];
}

export function IgnoredApplicationsList({ canAdd, feedback, identifiers, onChange, translations: t }: IgnoredApplicationsListProps) {
  const { apps, chooseApplications, clearError, error, isPicking } = useIgnoredSourceApps(identifiers, onChange);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeId = identifiers.includes(selectedId ?? "") ? selectedId : identifiers[0] ?? null;
  const errorText = error === "limit" ? t.ignoredSourceAppLimit
    : error === "invalid" ? t.ignoredSourceAppInvalid
      : error === "unavailable" ? t.sourceDetectionUnavailable
        : error === "failed" ? t.ignoredSourceAppPickerFailed : "";
  const feedbackText = feedback === "pending" ? t.saving : feedback === "saved" ? t.saved : feedback === "error" ? t.error : "";

  return (
    <div className={ui.ignoredApplications}>
      <div className={ui.ignoredApplicationsHeading}>{t.ignoredSourceAppListLabel}</div>
      <div aria-label={t.ignoredSourceAppListLabel} className={ui.ignoredApplicationsList} role="listbox">
        {apps.map((app, index) => (
          <button
            aria-selected={app.id === activeId}
            className={ui.ignoredApplicationRow(app.id === activeId)}
            key={app.id}
            onClick={() => setSelectedId(app.id)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowDown" ? Math.min(index + 1, apps.length - 1)
                : event.key === "ArrowUp" ? Math.max(index - 1, 0)
                  : event.key === "Home" ? 0 : event.key === "End" ? apps.length - 1 : null;
              if (next !== null) {
                event.preventDefault();
                setSelectedId(apps[next].id);
                rowRefs.current[next]?.focus();
              }
            }}
            ref={(element) => { rowRefs.current[index] = element; }}
            role="option"
            tabIndex={app.id === activeId ? 0 : -1}
            title={app.id}
            type="button"
          >
            {app.iconDataUrl ? <img alt="" className={ui.ignoredApplicationIcon} src={app.iconDataUrl} /> : (
              <svg aria-hidden="true" className={ui.ignoredApplicationFallback} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect height="17" rx="3" width="19" x="2.5" y="3.5" />
                <path d="M3 8h18M6 6h.01M9 6h.01" />
              </svg>
            )}
            <span className={ui.ignoredApplicationName}>{app.displayName}</span>
          </button>
        ))}
        {!apps.length ? <p className={ui.ignoredApplicationsEmpty}>{canAdd ? t.ignoredSourceAppEmpty : t.sourceDetectionUnavailable}</p> : null}
      </div>
      <div className={ui.ignoredApplicationsToolbar}>
        <button aria-label={t.ignoredSourceAppAdd} className={ui.ignoredApplicationsAction} disabled={!canAdd || isPicking || identifiers.length >= MAX_IGNORED_SOURCE_APP_COUNT} onClick={() => void chooseApplications()} title={t.ignoredSourceAppAdd} type="button">
          <span aria-hidden="true">+</span>
        </button>
        <button aria-label={t.ignoredSourceAppRemove} className={ui.ignoredApplicationsAction} disabled={!activeId || isPicking} onClick={() => {
          clearError();
          onChange(identifiers.filter((id) => id !== activeId));
        }} title={t.ignoredSourceAppRemove} type="button">
          <span aria-hidden="true">−</span>
        </button>
        <span aria-live="polite" className={`${ui.ignoredApplicationsStatus} ${feedback === "error" ? "text-[var(--mclip-danger)]" : "text-[var(--mclip-meta)]"}`}>
          {isPicking ? t.ignoredSourceAppChoosing : feedbackText || `${identifiers.length} / ${MAX_IGNORED_SOURCE_APP_COUNT}`}
        </span>
      </div>
      <p className={ui.ignoredApplicationsDescription}>{t.ignoredSourceAppDescription}</p>
      {errorText ? <div className={ui.settingsError} role="alert">{errorText}</div> : null}
    </div>
  );
}
