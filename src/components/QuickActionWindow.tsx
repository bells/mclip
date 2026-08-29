import { useCallback, useEffect, useState } from "react";
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
import { ui } from "../uiStyles";
import { DialogStatusBar } from "./DialogStatusBar";
import { DialogWindowFrame } from "./DialogWindowFrame";
import { Modal } from "./Modal";

export function QuickActionWindow() {
  const [payload, setPayload] = useState<QuickActionPayload | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);
  const [error, setError] = useState<"copy" | "replace" | null>(null);
  useApplyAppTheme(payload?.appearanceTheme ?? "system");
  const translations = getTranslations(payload?.language ?? "system");
  const t = translations.quickAction;

  const discardAndHide = useCallback(async () => {
    setPayload(null);
    setError(null);
    setIsConfirmingReplace(false);
    await hideCurrentWindow();
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    void listenToQuickActionUpdated((nextPayload) => {
      setPayload(nextPayload);
      setError(null);
      setIsConfirmingReplace(false);
      setIsReplacing(false);
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
      reportAuxiliaryListenerReady("quickActionUpdated");
    });
    return () => unlisten?.();
  }, []);

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

  const copyResult = async () => {
    setError(null);
    try {
      await copyTextToClipboard(payload.output);
      await discardAndHide();
    } catch {
      setError("copy");
    }
  };

  const replaceResult = async () => {
    setError(null);
    setIsReplacing(true);
    try {
      await replaceHistoryText(payload.targetId, payload.output);
      await discardAndHide();
    } catch {
      setError("replace");
      setIsConfirmingReplace(false);
    } finally {
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
            onClick={() => void discardAndHide()}
            type="button"
          >
            {t.cancel}
          </button>
          <button
            className={ui.modalSecondaryButton + " " + ui.modalButton}
            onClick={() => void copyResult()}
            type="button"
          >
            {t.copy}
          </button>
          <button
            className={ui.modalPrimaryButton + " " + ui.modalButton}
            onClick={() => setIsConfirmingReplace(true)}
            type="button"
          >
            {t.replace}
          </button>
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
                onClick={() => void replaceResult()}
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
