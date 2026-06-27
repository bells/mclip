import {
  DialogWindowControls,
  type DialogWindowControlLabels,
} from "./DialogWindowControls";

type DialogStatusBarProps = {
  controlsLabels: DialogWindowControlLabels;
  title: string;
};

export function DialogStatusBar({
  controlsLabels,
  title,
}: DialogStatusBarProps) {
  return (
    <div className="app-dialog-statusbar" data-dialog-drag-region>
      <span className="app-modal-title">{title}</span>
      <DialogWindowControls labels={controlsLabels} />
    </div>
  );
}
