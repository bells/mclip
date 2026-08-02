import { useCallback, useEffect, useRef, useState } from "react";

import { useApplyAppTheme } from "../hooks/useApplyAppTheme";
import { useImageDataUrl } from "../hooks/useImageDataUrl";
import { getTranslations } from "../i18n";
import { closeImageViewer, listenToImageViewerUpdated } from "../lib/tauri";
import type { ImageViewerPayload } from "../types";
import { ui } from "../uiStyles";
import { CloseIcon } from "./UiIcons";

export function FullscreenImageViewer() {
  const [payload, setPayload] = useState<ImageViewerPayload | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);
  const image = useImageDataUrl(payload?.imagePath ?? null);
  const translations = getTranslations(payload?.language ?? "system").imageViewer;
  useApplyAppTheme(payload?.appearanceTheme ?? "system");

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | undefined;

    void listenToImageViewerUpdated((nextPayload) => {
      isClosingRef.current = false;
      setIsClosing(false);
      setPayload(nextPayload);
    }).then((unsubscribe) => {
      if (isActive) {
        unlisten = unsubscribe;
        return;
      }

      unsubscribe();
    });

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, []);

  const requestClose = useCallback(async () => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    setIsClosing(true);

    try {
      await closeImageViewer();
      setPayload(null);
    } catch (error) {
      isClosingRef.current = false;
      setIsClosing(false);
      console.error("关闭全屏图片查看器失败:", error);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void requestClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [requestClose]);

  return (
    <div
      aria-label={translations.ariaLabel}
      aria-modal="true"
      className={ui.imageViewerFrame}
      role="dialog"
    >
      <button
        aria-label={translations.closeAriaLabel}
        className={ui.imageViewerCloseButton}
        disabled={isClosing}
        onClick={() => {
          void requestClose();
        }}
        title={translations.closeAriaLabel}
        type="button"
      >
        <CloseIcon className={ui.imageViewerCloseIcon} />
      </button>

      <div className={ui.imageViewerMedia}>
        {image.status === "ready" && payload ? (
          <img
            alt={payload.alt}
            className={ui.imageViewerImage}
            draggable={false}
            height={payload.height}
            src={image.src}
            width={payload.width}
          />
        ) : image.status === "error" ? (
          <div aria-live="polite" className={ui.imageViewerError} role="status">
            {translations.loadError}
          </div>
        ) : (
          <div
            aria-live="polite"
            className={ui.imageViewerLoading}
            role="status"
          >
            <span className={ui.imageViewerSkeleton} aria-hidden="true" />
            <span>{translations.loading}</span>
          </div>
        )}
      </div>
    </div>
  );
}
