import { hideCurrentWindow } from "../lib/tauri";
import { ui, windowControls } from "../uiStyles";

function WindowControlSymbol({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      className={ui.windowControlSymbol}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
      viewBox="0 0 12 12"
    >
      <path d={path} />
    </svg>
  );
}

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
      >
        <WindowControlSymbol path="M3 3l6 6M9 3l-6 6" />
      </button>
    ),
    maximize: (
      <button
        aria-label={labels.maximizeUnavailable}
        className={`${ui.windowControl} ${ui.windowControlMaximize}`}
        disabled
        key="maximize"
        title={labels.maximizeUnavailable}
        type="button"
      >
        <WindowControlSymbol path="M2.5 6h7M6 2.5v7" />
      </button>
    ),
    minimize: (
      <button
        aria-label={labels.minimizeUnavailable}
        className={`${ui.windowControl} ${ui.windowControlMinimize}`}
        disabled
        key="minimize"
        title={labels.minimizeUnavailable}
        type="button"
      >
        <WindowControlSymbol path="M2.5 6h7" />
      </button>
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
