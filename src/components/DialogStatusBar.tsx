import {
  DialogWindowControls,
  getPreferredWindowControlSide,
  type DialogWindowControlLabels,
} from "./DialogWindowControls";
import { ui } from "../uiStyles";

type DialogStatusBarProps = {
  controlsLabels: DialogWindowControlLabels;
  title: string;
};

export function DialogStatusBar({
  controlsLabels,
  title,
}: DialogStatusBarProps) {
  const controlSide = getPreferredWindowControlSide();

  return (
    <div
      className={ui.dialogStatusBar(controlSide)}
      data-dialog-drag-region
    >
      {controlSide === "left" ? (
        <>
          <DialogWindowControls labels={controlsLabels} />
          <span className={ui.modalTitle}>{title}</span>
        </>
      ) : (
        <>
          <span className={ui.modalTitle}>{title}</span>
          <DialogWindowControls labels={controlsLabels} />
        </>
      )}
    </div>
  );
}
