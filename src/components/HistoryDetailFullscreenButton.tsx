import { useState } from "react";

import { ui } from "../uiStyles";
import { ExpandIcon } from "./UiIcons";

type HistoryDetailFullscreenButtonProps = {
  disabled?: boolean;
  label: string;
  onOpen: () => Promise<void>;
};

export function HistoryDetailFullscreenButton({
  disabled = false,
  label,
  onOpen,
}: HistoryDetailFullscreenButtonProps) {
  const [isOpening, setIsOpening] = useState(false);

  return (
    <button
      aria-label={label}
      className={ui.historyDetailFullscreenButton}
      disabled={disabled || isOpening}
      onClick={(event) => {
        event.stopPropagation();

        if (isOpening) {
          return;
        }

        setIsOpening(true);
        void onOpen()
          .catch((error) => {
            console.error("打开图片查看器失败:", error);
          })
          .finally(() => {
            setIsOpening(false);
          });
      }}
      title={label}
      type="button"
    >
      <ExpandIcon className={ui.fullscreenIcon} />
    </button>
  );
}
