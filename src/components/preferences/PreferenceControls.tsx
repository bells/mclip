import { useId, type ReactNode } from "react";

import type { PreferenceFeedbackState } from "./preferenceSaveController";
import { ui } from "../../uiStyles";

type PreferenceGroupProps = {
  children: ReactNode;
  label: string;
};

export function PreferenceGroup({ children, label }: PreferenceGroupProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={ui.preferenceGroup}>
      <h2 className={ui.preferenceGroupTitle} id={headingId}>
        {label}
      </h2>
      <div className={ui.preferenceGroupBody}>{children}</div>
    </section>
  );
}

type PreferencePageProps = {
  children: ReactNode;
  description: string;
  title: string;
};

export function PreferencePage({ children, description, title }: PreferencePageProps) {
  return (
    <div className={ui.preferencePage} role="tabpanel">
      <header className={ui.preferencePageHeader}>
        <h1 className={ui.preferencePageTitle}>{title}</h1>
        <p className={ui.preferencePageDescription}>{description}</p>
      </header>
      <div className={ui.preferencePageGroups}>{children}</div>
    </div>
  );
}

type PreferenceRowProps = {
  children: ReactNode;
  description: string;
  feedback?: PreferenceFeedbackState;
  feedbackLabels?: { error: string; pending: string; saved: string };
  focusTargetId?: string;
  label: string;
  note?: ReactNode;
};

export function PreferenceRow({
  children,
  description,
  feedback = "idle",
  feedbackLabels,
  focusTargetId,
  label,
  note,
}: PreferenceRowProps) {
  const labelId = useId();
  const descriptionId = useId();
  const feedbackText = feedbackLabels
    ? feedback === "pending"
      ? feedbackLabels.pending
      : feedback === "saved"
        ? feedbackLabels.saved
        : feedback === "error"
          ? feedbackLabels.error
          : ""
    : "";

  return (
    <div className={ui.preferenceRow} id={focusTargetId}>
      <div className={ui.preferenceRowCopy}>
        <div className={ui.preferenceRowLabel} id={labelId}>
          {label}
        </div>
        <div className={ui.preferenceRowDescription} id={descriptionId}>
          {description}
        </div>
        {note ? <div className={ui.preferenceRowNote}>{note}</div> : null}
        {feedbackText ? (
          <div
            aria-live="polite"
            className={
              feedback === "error"
                ? ui.preferenceFeedbackError
                : ui.preferenceFeedback
            }
          >
            {feedbackText}
          </div>
        ) : null}
      </div>
      <div
        aria-describedby={descriptionId}
        aria-labelledby={labelId}
        className={ui.preferenceRowControl}
      >
        {children}
      </div>
    </div>
  );
}

type PreferenceSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
};

export function PreferenceSwitch({
  checked,
  disabled = false,
  label,
  onChange,
}: PreferenceSwitchProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={ui.preferenceSwitch(checked)}
      disabled={disabled}
      onClick={onChange}
      role="switch"
      type="button"
    >
      <span className={ui.preferenceSwitchThumb} />
    </button>
  );
}
