import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Toaster, toast } from "sonner";

import { getTranslations } from "../i18n";
import { listenToPinFailureNotice, listenToSettingsUpdated } from "../services/ipc/events";
import type { AppLanguage } from "../types";
import { getPinFailureNotice } from "../utils/pinHistory";

const TOAST_ID = "pin-failure";

export function PinToastHost({ language }: { language: AppLanguage }) {
  const [currentLanguage, setLanguage] = useState(language);
  const languageRef = useRef(currentLanguage);
  languageRef.current = currentLanguage;
  useEffect(() => setLanguage(language), [language]);
  useEffect(() => {
    let active = true;
    const cleanups: (() => void)[] = [];
    const register = (subscription: Promise<() => void>) => {
      void subscription.then((unsubscribe) => {
        if (active) cleanups.push(unsubscribe);
        else unsubscribe();
      }).catch(() => {});
    };
    register(listenToSettingsUpdated((settings) => {
      if (active) setLanguage(settings.language);
    }));
    register(listenToPinFailureNotice((payload) => {
      void getCurrentWindow().isVisible().then((visible) => {
        if (!active || !visible) return;
        const notice = getPinFailureNotice(payload);
        const t = getTranslations(languageRef.current).history;
        const message = notice.code === "pinnedHistoryLimitReached"
          ? `${t.pinLimitTitle} (${notice.current}/${notice.max}) · ${notice.max < 20 ? t.pinLimitAdvice : t.pinLimitUnpinAdvice}`
          : t.pinMutationFailed;
        toast(message, { id: TOAST_ID, duration: 6000, dismissible: false });
      }).catch(() => {});
    }));
    return () => {
      active = false;
      cleanups.forEach((cleanup) => cleanup());
      toast.dismiss(TOAST_ID);
    };
  }, []);
  return <Toaster
    position="bottom-center" visibleToasts={1} duration={6000} hotkey={[]}
    closeButton={false} swipeDirections={[]} offset={8} mobileOffset={8}
    style={{ width: "min(360px, calc(100vw - 16px))" }}
    toastOptions={{ style: {
      background: "var(--mclip-surface)", color: "var(--mclip-ink)",
      border: "1px solid var(--mclip-line-strong)", fontFamily: "inherit",
      fontSize: "12px", padding: "12px", overflowWrap: "anywhere",
      pointerEvents: "none",
    } }}
  />;
}
