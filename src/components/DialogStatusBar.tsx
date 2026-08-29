import {
  DialogWindowControls,
  getPreferredWindowControlSide,
  type DialogWindowControlLabels,
} from "./DialogWindowControls";
import { dialogStatusBar, ui } from "../uiStyles";

type DialogStatusBarProps = {
  centerTitle?: boolean;
  controlsLabels: DialogWindowControlLabels;
  title: string;
  onClose?: () => void;
};

export function DialogStatusBar({
  centerTitle = false,
  controlsLabels,
  title,
  onClose,
}: DialogStatusBarProps) {
  const controlSide = getPreferredWindowControlSide();
  const titleClassName = [ui.modalTitle, centerTitle ? ui.dialogCenteredTitle : ""]
    .filter(Boolean)
    .join(" ");

  if (centerTitle) {
    return (
      <div
        className={dialogStatusBar(controlSide, true)}
        data-dialog-drag-region
      >
        <DialogWindowControls labels={controlsLabels} onClose={onClose} />
        <span className={titleClassName}>{title}</span>
      </div>
    );
  }

  return (
    <div
      className={dialogStatusBar(controlSide)}
      data-dialog-drag-region
    >
      {controlSide === "left" ? (
        <>
          <DialogWindowControls labels={controlsLabels} onClose={onClose} />
          <span className={titleClassName}>{title}</span>
        </>
      ) : (
        <>
          <span className={titleClassName}>{title}</span>
          <DialogWindowControls labels={controlsLabels} onClose={onClose} />
        </>
      )}
    </div>
  );
}
