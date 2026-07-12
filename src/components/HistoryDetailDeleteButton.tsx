import { ui } from "../uiStyles";
import { TrashIcon } from "./UiIcons";

type HistoryDetailDeleteButtonProps = {
  disabled?: boolean;
  label: string;
  onDelete: () => void;
};

export function HistoryDetailDeleteButton({
  disabled = false,
  label,
  onDelete,
}: HistoryDetailDeleteButtonProps) {
  return (
    <button
      aria-label={label}
      className={ui.historyDetailActionButton}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      title={label}
      type="button"
    >
      <TrashIcon className={ui.deleteIcon} />
    </button>
  );
}
