import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AppSettings,
  HistoryEntry,
  HistoryItemPreviewPayload,
  HistoryPreviewGroupItemActivatedPayload,
  HistoryPreviewKeyboardNavigationPayload,
  HistoryPreviewMeasuredPayload,
  HistoryPreviewPayload,
} from "../../types";
import type { PreviewWindowPosition } from "./commands";

const HISTORY_UPDATED_EVENT = "history-updated";
const SETTINGS_UPDATED_EVENT = "settings-updated";
const HISTORY_PREVIEW_UPDATED_EVENT = "history-preview-updated";
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
const MAIN_WINDOW_SHOWN_EVENT = "main-window-shown";
const MAIN_WINDOW_LABEL = "main";
const PREVIEW_WINDOW_LABEL = "preview";
const PREVIEW_DETAIL_WINDOW_LABEL = "preview-detail";

export function updateHistoryPreviewWindow(payload: HistoryPreviewPayload) {
  return emitTo(PREVIEW_WINDOW_LABEL, HISTORY_PREVIEW_UPDATED_EVENT, payload);
}

export function updateHistoryPreviewDetailWindow(
  payload: HistoryItemPreviewPayload,
) {
  return emitTo(
    PREVIEW_DETAIL_WINDOW_LABEL,
    HISTORY_PREVIEW_UPDATED_EVENT,
    payload,
  );
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

export function listenToHistoryUpdated(
  handler: (history: HistoryEntry[]) => void,
): Promise<UnlistenFn> {
  return listen<HistoryEntry[]>(HISTORY_UPDATED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToSettingsUpdated(
  handler: (settings: AppSettings) => void,
): Promise<UnlistenFn> {
  return listen<AppSettings>(SETTINGS_UPDATED_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenToMainWindowShown(handler: () => void): Promise<UnlistenFn> {
  return listen(MAIN_WINDOW_SHOWN_EVENT, () => {
    handler();
  });
}

export function listenToHistoryPreviewUpdated(
  handler: (payload: HistoryPreviewPayload) => void,
): Promise<UnlistenFn> {
  return listen<HistoryPreviewPayload>(HISTORY_PREVIEW_UPDATED_EVENT, (event) => {
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
