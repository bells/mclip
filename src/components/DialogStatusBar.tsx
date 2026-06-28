import {
  DialogWindowControls,
  getPreferredWindowControlSide,
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
  const controlSide = getPreferredWindowControlSide();

  return (
    <div
      className={`app-dialog-statusbar is-controls-${controlSide}`}
      data-dialog-drag-region
    >
      {controlSide === "left" ? (
        <>
          <DialogWindowControls labels={controlsLabels} />
          <span className="app-modal-title">{title}</span>
        </>
      ) : (
        <>
          <span className="app-modal-title">{title}</span>
          <DialogWindowControls labels={controlsLabels} />
        </>
      )}
    </div>
  );
}
