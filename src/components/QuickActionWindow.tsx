import { useCallback, useEffect, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

import { useApplyAppTheme } from "../hooks/useApplyAppTheme";
import { getTranslations } from "../i18n";
import { reportAuxiliaryListenerReady } from "../services/auxiliaryWindows";
import {
  copyTextToClipboard,
  replaceHistoryText,
} from "../services/ipc/commands";
import { listenToQuickActionUpdated } from "../services/ipc/events";
import { hideCurrentWindow } from "../services/ipc/windows";
import type { QuickActionPayload } from "../types";
import { createPayloadOperationGuard } from "../utils/payloadOperationGuard";
import { ui } from "../uiStyles";
import { DialogStatusBar } from "./DialogStatusBar";
import { DialogWindowFrame } from "./DialogWindowFrame";
import { Modal } from "./Modal";

export function QuickActionWindow() {
  const [payload, setPayload] = useState<QuickActionPayload | null>(null);
  const guard = useRef(createPayloadOperationGuard()).current;
  const [isOperating, setIsOperating] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);
  const [error, setError] = useState<"copy" | "replace" | null>(null);
  useApplyAppTheme(payload?.appearanceTheme ?? "system");
  const translations = getTranslations(payload?.language ?? "system");
  const t = translations.quickAction;

  const discardAndHide = useCallback(async () => {
    guard.invalidate();
    setPayload(null);
    setError(null);
    setIsConfirmingReplace(false);
    await hideCurrentWindow();
  }, [guard]);

  useEffect(() => {
    let active = true;
    let unlisten: UnlistenFn | undefined;
    void listenToQuickActionUpdated((nextPayload) => {
      guard.invalidate();
      setPayload(nextPayload);
      setError(null);
      setIsConfirmingReplace(false);
      setIsReplacing(false);
    }).then((unsubscribe) => {
      if (!active) { unsubscribe(); return; }
      unlisten = unsubscribe;
      reportAuxiliaryListenerReady("quickActionUpdated");
    });
    return () => { active = false; guard.invalidate(); unlisten?.(); };
  }, [guard]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      if (isConfirmingReplace) {
        setIsConfirmingReplace(false);
      } else {
        void discardAndHide();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [discardAndHide, isConfirmingReplace]);

  if (!payload) {
    return null;
  }

  const performOperation = async (kind: "copy" | "replace") => {
    const token = guard.begin();
    if (token === null) return;
    setIsOperating(true);
    setIsReplacing(kind === "replace");
    setError(null);
    try {
      if (kind === "copy") await copyTextToClipboard(payload.output);
      else await replaceHistoryText(payload.targetId, payload.output);
      if (guard.isCurrent(token)) await discardAndHide();
    } catch {
      if (guard.isCurrent(token)) {
        setError(kind);
        setIsConfirmingReplace(false);
      }
    } finally {
      guard.finish();
      setIsOperating(false);
      setIsReplacing(false);
    }
  };

  return (
    <DialogWindowFrame className={ui.quickActionWindowFrame}>
      <DialogStatusBar
        centerTitle
        controlsLabels={translations.windowControls}
        onClose={() => void discardAndHide()}
        title={t.title}
      />
      <main className={ui.quickActionWindowBody}>
        <div className={ui.quickActionStatusBar}>
          <strong>{t.actionLabels[payload.action]}</strong>
          <span>{t.byteSummary(payload.inputBytes, payload.outputBytes)}</span>
        </div>
        <pre
          aria-label={t.resultAriaLabel}
          className={ui.quickActionResult}
          tabIndex={0}
        >
          {payload.output}
        </pre>
        {error ? (
          <p className={ui.quickActionWindowError} role="status">
            {error === "copy" ? t.copyError : t.replaceError}
          </p>
        ) : null}
        <div className={ui.quickActionWindowFooter}>
          <button
            className={ui.modalSecondaryButton + " " + ui.modalButton}
            disabled={isOperating}
            onClick={() => setIsConfirmingReplace(true)}
            type="button"
          >{t.replace}</button>
          <button
            className={ui.modalPrimaryButton + " " + ui.modalButton}
            disabled={isOperating}
            aria-busy={isOperating && !isReplacing}
            onClick={() => void performOperation("copy")}
            type="button"
          >{t.copy}</button>
        </div>
      </main>

      {isConfirmingReplace ? (
        <Modal
          footer={
            <>
              <button
                className={ui.modalSecondaryButton + " " + ui.modalButton}
                disabled={isReplacing}
                onClick={() => setIsConfirmingReplace(false)}
                type="button"
              >
                {t.cancel}
              </button>
              <button
                className={ui.modalDangerButton + " " + ui.modalButton}
                disabled={isReplacing}
                onClick={() => void performOperation("replace")}
                type="button"
              >
                {isReplacing ? t.replacing : t.confirmReplace}
              </button>
            </>
          }
          onRequestClose={() => setIsConfirmingReplace(false)}
          title={t.confirmTitle}
        >
          {t.confirmMessage}
        </Modal>
      ) : null}
    </DialogWindowFrame>
  );
}
