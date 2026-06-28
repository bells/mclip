import { hideCurrentWindow } from "../lib/tauri";

export type DialogWindowControlLabels = {
  close: string;
  maximizeUnavailable: string;
  minimizeUnavailable: string;
};

export type DialogWindowControlSide = "left" | "right";

type DialogWindowControlsProps = {
  labels: DialogWindowControlLabels;
};

export function getPreferredWindowControlSide(): DialogWindowControlSide {
  const platform = navigator.platform.toLowerCase();

  return platform.includes("mac") ? "left" : "right";
}

export function DialogWindowControls({ labels }: DialogWindowControlsProps) {
  const side = getPreferredWindowControlSide();
  const controls = {
    close: (
      <button
        aria-label={labels.close}
        className="app-window-control app-window-control-close"
        key="close"
        onClick={() => {
          void hideCurrentWindow();
        }}
        title={labels.close}
        type="button"
      />
    ),
    maximize: (
      <button
        aria-label={labels.maximizeUnavailable}
        className="app-window-control app-window-control-maximize"
        disabled
        key="maximize"
        title={labels.maximizeUnavailable}
        type="button"
      />
    ),
    minimize: (
      <button
        aria-label={labels.minimizeUnavailable}
        className="app-window-control app-window-control-minimize"
        disabled
        key="minimize"
        title={labels.minimizeUnavailable}
        type="button"
      />
    ),
  };

  return (
    <div className={`app-window-controls is-${side}`} data-dialog-drag-exclude>
      {side === "left"
        ? [controls.close, controls.minimize, controls.maximize]
        : [controls.minimize, controls.maximize, controls.close]}
    </div>
  );
}
