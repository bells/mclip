import { getCurrentWindow, Window as TauriWindow } from "@tauri-apps/api/window";

const MAIN_WINDOW_LABEL = "main";

type TauriWindowMetadata = Window & {
  __TAURI_INTERNALS__?: {
    metadata?: {
      currentWindow?: {
        label?: string;
      };
    };
  };
};

export function hideCurrentWindow() {
  return getCurrentWindow().hide();
}

export function startCurrentWindowDrag() {
  return getCurrentWindow().startDragging();
}

export async function hideMainWindow() {
  const mainWindow = await TauriWindow.getByLabel(MAIN_WINDOW_LABEL);
  await mainWindow?.hide();
}

export function getCurrentWindowLabel() {
  return (
    (window as TauriWindowMetadata).__TAURI_INTERNALS__?.metadata?.currentWindow
      ?.label ?? MAIN_WINDOW_LABEL
  );
}
