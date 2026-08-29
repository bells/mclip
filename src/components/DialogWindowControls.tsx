import { hideCurrentWindow } from "../lib/tauri";
import { ui, windowControls } from "../uiStyles";

export type DialogWindowControlLabels = {
  close: string;
  maximizeUnavailable: string;
  minimizeUnavailable: string;
};

export type DialogWindowControlSide = "left" | "right";

type DialogWindowControlsProps = {
  labels: DialogWindowControlLabels;
  onClose?: () => void;
};

export function getPreferredWindowControlSide(): DialogWindowControlSide {
  const platform = navigator.platform.toLowerCase();

  return platform.includes("mac") ? "left" : "right";
}

export function DialogWindowControls({ labels, onClose }: DialogWindowControlsProps) {
  const side = getPreferredWindowControlSide();
  const controls = {
    close: (
      <button
        aria-label={labels.close}
        className={`${ui.windowControl} ${ui.windowControlClose}`}
        key="close"
        onClick={() => {
          if (onClose) {
            onClose();
          } else {
            void hideCurrentWindow();
          }
        }}
        title={labels.close}
        type="button"
      />
    ),
    maximize: (
      <button
        aria-label={labels.maximizeUnavailable}
        className={`${ui.windowControl} ${ui.windowControlMaximize}`}
        disabled
        key="maximize"
        title={labels.maximizeUnavailable}
        type="button"
      />
    ),
    minimize: (
      <button
        aria-label={labels.minimizeUnavailable}
        className={`${ui.windowControl} ${ui.windowControlMinimize}`}
        disabled
        key="minimize"
        title={labels.minimizeUnavailable}
        type="button"
      />
    ),
  };

  return (
    <div className={windowControls(side)} data-dialog-drag-exclude>
      {side === "left"
        ? [controls.close, controls.minimize, controls.maximize]
        : [controls.minimize, controls.maximize, controls.close]}
    </div>
  );
}
