import { ui } from "../uiStyles";
import { getTextHistoryAffordance } from "../utils/historyAffordance";

type HistoryListTextProps = {
  className: string;
  displayText: string;
  text: string;
};

export function HistoryListText({
  className,
  displayText,
  text,
}: HistoryListTextProps) {
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
