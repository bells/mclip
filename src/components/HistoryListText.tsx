import { ui } from "../uiStyles";
import { getTextHistoryAffordance } from "../utils/historyAffordance";

type HistoryListTextProps = {
  className: string;
  displayText: string;
  sensitiveLabel: string;
  isSensitive: boolean;
  text: string;
};

export function HistoryListText({
  className,
  displayText,
  sensitiveLabel,
  isSensitive,
  text,
}: HistoryListTextProps) {
  if (isSensitive) {
    return (
      <span className={`${className} ${ui.historySensitiveText}`}>
        <span aria-label={sensitiveLabel} className={ui.historySensitiveBadge}>
          {sensitiveLabel}
        </span>
        <span className={ui.historyDisplayText}>{displayText}</span>
      </span>
    );
  }

  const textAffordance = getTextHistoryAffordance(text);

  if (textAffordance?.kind === "emoji") {
    return (
      <span className={`${className} ${ui.historyTextWithAffordance}`}>
        <span className={ui.historyAffordance}>
          <span className={ui.historyEmojiBadge}>{textAffordance.emoji}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={`${className} ${
        textAffordance ? ui.historyTextWithAffordance : ""
      }`}
    >
      {textAffordance?.kind === "color" ? (
        <span className={ui.historyAffordance} aria-hidden="true">
          <span
            className={ui.historyColorSwatch}
            style={{ background: textAffordance.color }}
          />
        </span>
      ) : null}
      <span className={ui.historyDisplayText}>{displayText}</span>
    </span>
  );
}
