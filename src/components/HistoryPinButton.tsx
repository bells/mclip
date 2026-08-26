import { ui } from "../uiStyles";
import { PinIcon } from "./UiIcons";

type HistoryPinButtonProps = {
  isPinned: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
  disabled?: boolean;
};

export function HistoryPinButton({
  isPinned,
  label,
  onToggle,
  className = ui.historyDetailPinButton,
  disabled = false,
}: HistoryPinButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={isPinned}
      className={className}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      title={label}
      type="button"
    >
      <PinIcon className={ui.pinIcon} />
    </button>
  );
}
