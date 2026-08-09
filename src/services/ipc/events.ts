import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AppSettings,
  HistoryChange,
  HistoryItemPreviewPayload,
  HistoryPreviewGroupItemActivatedPayload,
  HistoryPreviewKeyboardNavigationPayload,
  HistoryPreviewMeasuredPayload,
  HistoryPreviewInvalidation,
  HistoryPreviewPayload,
  ImageViewerPayload,
  PerformanceAutomationAction,
  PerformanceInteraction,
} from "../../types";
import type { PreviewWindowPosition } from "./commands";

const HISTORY_CHANGED_EVENT = "history-changed";
const HISTORY_PREVIEW_INVALIDATED_EVENT = "history-preview-invalidated";
const SETTINGS_UPDATED_EVENT = "settings-updated";
const HISTORY_PREVIEW_UPDATED_EVENT = "history-preview-updated";
const HISTORY_PREVIEW_DETAIL_UPDATED_EVENT =
  "history-preview-detail-updated";
const HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT =
  "history-preview-placement-updated";
const HISTORY_PREVIEW_KEYBOARD_NAVIGATION_EVENT =
  "history-preview-keyboard-navigation";
const HISTORY_PREVIEW_GROUP_ITEM_ACTIVATED_EVENT =
  "history-preview-group-item-activated";
const HISTORY_PREVIEW_MEASURED_EVENT = "history-preview-measured";
const HISTORY_PREVIEW_CLOSE_REQUESTED_EVENT = "history-preview-close-requested";
const HISTORY_PREVIEW_POINTER_ENTERED_EVENT = "history-preview-pointer-entered";
const HISTORY_PREVIEW_SELECTION_STARTED_EVENT =
  "history-preview-selection-started";
const HISTORY_PREVIEW_SELECTION_CANCELLED_EVENT =
  "history-preview-selection-cancelled";
const IMAGE_VIEWER_UPDATED_EVENT = "image-viewer-updated";
const MAIN_WINDOW_SHOWN_EVENT = "main-window-shown";
const PERFORMANCE_AUTOMATION_EVENT = "performance-automation";
const MAIN_WINDOW_LABEL = "main";
const PREVIEW_WINDOW_LABEL = "preview";
const PREVIEW_DETAIL_WINDOW_LABEL = "preview-detail";
const IMAGE_VIEWER_WINDOW_LABEL = "image-viewer";

export function updateHistoryPreviewWindow(payload: HistoryPreviewPayload) {
  return emitTo(PREVIEW_WINDOW_LABEL, HISTORY_PREVIEW_UPDATED_EVENT, payload);
}

export function updateHistoryPreviewDetailWindow(
  payload: HistoryItemPreviewPayload,
) {
  return emitTo(
    PREVIEW_DETAIL_WINDOW_LABEL,
    HISTORY_PREVIEW_DETAIL_UPDATED_EVENT,
    payload,
  );
}

export function updateImageViewerWindow(payload: ImageViewerPayload) {
  return emitTo(IMAGE_VIEWER_WINDOW_LABEL, IMAGE_VIEWER_UPDATED_EVENT, payload);
}

export function sendHistoryPreviewKeyboardNavigation(
  payload: HistoryPreviewKeyboardNavigationPayload,
) {
  return emitTo(
    PREVIEW_WINDOW_LABEL,
    HISTORY_PREVIEW_KEYBOARD_NAVIGATION_EVENT,
    payload,
  );
}

export function notifyHistoryPreviewGroupItemActivated(
  payload: HistoryPreviewGroupItemActivatedPayload,
) {
  return emitTo(
    MAIN_WINDOW_LABEL,
    HISTORY_PREVIEW_GROUP_ITEM_ACTIVATED_EVENT,
    payload,
  );
}

export function reportHistoryPreviewMeasured(
  payload: HistoryPreviewMeasuredPayload,
) {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_MEASURED_EVENT, payload);
}

export function notifyHistoryPreviewPlacementUpdated(
  placement: PreviewWindowPosition,
) {
  return emitTo(
    MAIN_WINDOW_LABEL,
    HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT,
    placement,
  );
}

export function requestHistoryPreviewClose() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_CLOSE_REQUESTED_EVENT);
}

export function notifyHistoryPreviewPointerEntered() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_POINTER_ENTERED_EVENT);
}

export function notifyHistoryPreviewSelectionStarted() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_SELECTION_STARTED_EVENT);
}

export function notifyHistoryPreviewSelectionCancelled() {
  return emitTo(MAIN_WINDOW_LABEL, HISTORY_PREVIEW_SELECTION_CANCELLED_EVENT);
}

export function listenToHistoryChanged(
  handler: (change: HistoryChange) => void,
): Promise<UnlistenFn> {
  return listen<HistoryChange>(HISTORY_CHANGED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToHistoryPreviewInvalidated(
  handler: (invalidation: HistoryPreviewInvalidation) => void,
): Promise<UnlistenFn> {
  return listen<HistoryPreviewInvalidation>(
    HISTORY_PREVIEW_INVALIDATED_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToSettingsUpdated(
  handler: (settings: AppSettings) => void,
): Promise<UnlistenFn> {
  return listen<AppSettings>(SETTINGS_UPDATED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToMainWindowShown(
  handler: (interactionId: string | null) => void,
): Promise<UnlistenFn> {
  return listen<PerformanceInteraction>(MAIN_WINDOW_SHOWN_EVENT, (event) => {
    handler(event.payload?.interactionId ?? null);
  });
}

export function listenToPerformanceAutomation(
  handler: (action: PerformanceAutomationAction) => void,
): Promise<UnlistenFn> {
  return listen<PerformanceAutomationAction>(
    PERFORMANCE_AUTOMATION_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToHistoryPreviewUpdated(
  handler: (payload: HistoryPreviewPayload) => void,
): Promise<UnlistenFn> {
  return listen<HistoryPreviewPayload>(HISTORY_PREVIEW_UPDATED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToHistoryPreviewDetailUpdated(
  handler: (payload: HistoryItemPreviewPayload) => void,
): Promise<UnlistenFn> {
  return listen<HistoryItemPreviewPayload>(
    HISTORY_PREVIEW_DETAIL_UPDATED_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToImageViewerUpdated(
  handler: (payload: ImageViewerPayload) => void,
): Promise<UnlistenFn> {
  return listen<ImageViewerPayload>(IMAGE_VIEWER_UPDATED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToHistoryPreviewPlacementUpdated(
  handler: (placement: PreviewWindowPosition) => void,
): Promise<UnlistenFn> {
  return listen<PreviewWindowPosition>(
    HISTORY_PREVIEW_PLACEMENT_UPDATED_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToHistoryPreviewKeyboardNavigation(
  handler: (payload: HistoryPreviewKeyboardNavigationPayload) => void,
): Promise<UnlistenFn> {
  return listen<HistoryPreviewKeyboardNavigationPayload>(
    HISTORY_PREVIEW_KEYBOARD_NAVIGATION_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToHistoryPreviewGroupItemActivated(
  handler: (payload: HistoryPreviewGroupItemActivatedPayload) => void,
): Promise<UnlistenFn> {
  return listen<HistoryPreviewGroupItemActivatedPayload>(
    HISTORY_PREVIEW_GROUP_ITEM_ACTIVATED_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToHistoryPreviewMeasured(
  handler: (payload: HistoryPreviewMeasuredPayload) => void,
): Promise<UnlistenFn> {
  return listen<HistoryPreviewMeasuredPayload>(
    HISTORY_PREVIEW_MEASURED_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function listenToHistoryPreviewCloseRequested(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(HISTORY_PREVIEW_CLOSE_REQUESTED_EVENT, () => {
    handler();
  });
}

export function listenToHistoryPreviewPointerEntered(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(HISTORY_PREVIEW_POINTER_ENTERED_EVENT, () => {
    handler();
  });
}

export function listenToHistoryPreviewSelectionStarted(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(HISTORY_PREVIEW_SELECTION_STARTED_EVENT, () => {
    handler();
  });
}

export function listenToHistoryPreviewSelectionCancelled(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(HISTORY_PREVIEW_SELECTION_CANCELLED_EVENT, () => {
    handler();
  });
}
