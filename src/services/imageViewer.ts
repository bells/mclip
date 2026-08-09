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
import { createPerformanceInteractionId } from "./performance";
import { ensureAuxiliaryWindowReady } from "./auxiliaryWindows";

export async function openImageViewer(
  payload: Omit<ImageViewerPayload, "performanceInteractionId">,
) {
  await notifyHistoryPreviewSelectionStarted();
  const performanceInteractionId = createPerformanceInteractionId("viewer");
  const measuredPayload = { ...payload, performanceInteractionId };

  try {
    await ensureAuxiliaryWindowReady("image-viewer");
    await updateImageViewerWindow(measuredPayload);
    await showImageViewerWindow(performanceInteractionId);
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
