import type { AuxiliaryWindowLabel } from "../types";
import { ensureAuxiliaryWindow, markAuxiliaryWindowReady } from "./ipc/commands";
import { getCurrentWindowLabel } from "./ipc/windows";

export type AuxiliaryListenerToken =
  | "historyPreviewUpdated"
  | "historyPreviewInvalidated"
  | "imageViewerUpdated"
  | "keyboardNavigation"
  | "performanceAutomation"
  | "placementUpdated"
  | "previewDetailUpdated"
  | "settingsUpdated";

const expectedListenerTokens: Record<
  AuxiliaryWindowLabel,
  ReadonlySet<AuxiliaryListenerToken>
> = {
  about: new Set(["settingsUpdated"]),
  "image-viewer": new Set(["imageViewerUpdated"]),
  preferences: new Set(["settingsUpdated"]),
  preview: new Set([
    "historyPreviewUpdated",
    "historyPreviewInvalidated",
    "keyboardNavigation",
    "performanceAutomation",
  ]),
  "preview-detail": new Set(["placementUpdated", "previewDetailUpdated"]),
};

const readyListenerTokens = new Set<AuxiliaryListenerToken>();
let readyAcknowledgementStarted = false;

function getCurrentAuxiliaryGeneration() {
  const value = new URLSearchParams(window.location.search).get(
    "mclipWindowGeneration",
  );
  if (value === null) {
    return null;
  }

  const generation = Number(value);
  return Number.isSafeInteger(generation) && generation > 0 ? generation : null;
}

export function ensureAuxiliaryWindowReady(label: AuxiliaryWindowLabel) {
  return ensureAuxiliaryWindow(label);
}

export function reportAuxiliaryListenerReady(token: AuxiliaryListenerToken) {
  const label = getCurrentWindowLabel() as AuxiliaryWindowLabel;
  const expectedTokens = expectedListenerTokens[label];
  const generation = getCurrentAuxiliaryGeneration();
  if (!expectedTokens?.has(token) || generation === null) {
    return;
  }

  readyListenerTokens.add(token);
  if (
    readyAcknowledgementStarted ||
    [...expectedTokens].some((expectedToken) => !readyListenerTokens.has(expectedToken))
  ) {
    return;
  }

  readyAcknowledgementStarted = true;
  void markAuxiliaryWindowReady(generation).then((accepted) => {
    if (!accepted) {
      readyAcknowledgementStarted = false;
    }
  }).catch((error) => {
    readyAcknowledgementStarted = false;
    console.error("辅助窗口 ready 确认失败:", error);
  });
}
