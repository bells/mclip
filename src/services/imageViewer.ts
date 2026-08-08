import type { ImageViewerPayload } from "../types";
import {
  closeImageViewerWindow,
  showImageViewerWindow,
  toggleImageViewerMaximizeWindow,
} from "./ipc/commands";
import {
  notifyHistoryPreviewSelectionCancelled,
  notifyHistoryPreviewSelectionStarted,
  updateImageViewerWindow,
} from "./ipc/events";

export async function openImageViewer(payload: ImageViewerPayload) {
  await notifyHistoryPreviewSelectionStarted();

  try {
    await updateImageViewerWindow(payload);
    await showImageViewerWindow();
  } catch (error) {
    await notifyHistoryPreviewSelectionCancelled().catch(() => undefined);
    throw error;
  }
}

export function closeImageViewer() {
  return closeImageViewerWindow();
}

export function toggleImageViewerMaximize() {
  return toggleImageViewerMaximizeWindow();
}
