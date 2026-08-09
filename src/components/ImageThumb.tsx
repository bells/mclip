// 通过 Tauri command 读取图片文件为 base64，用 data: URL 渲染，
// 绕过 asset protocol 的兼容性问题。

import { useEffect, useRef, type ReactNode } from "react";

import { useImageDataUrl } from "../hooks/useImageDataUrl";
import { getCurrentWindowLabel } from "../services/ipc/windows";
import {
  recordFrontendPerformance,
  recordFrontendPerformanceAfterPaint,
} from "../services/performance";
import type { PerformanceWindowLabel } from "../types";

type ImageThumbProps = {
  alt: string;
  className: string;
  errorFallback?: ReactNode;
  imagePath: string;
  loadingFallback?: ReactNode;
  performanceInteractionId?: string | null;
};

export function ImageThumb({
  alt,
  className,
  errorFallback = null,
  imagePath,
  loadingFallback = null,
  performanceInteractionId = null,
}: ImageThumbProps) {
  const image = useImageDataUrl(imagePath);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const recordedReadyInteractionIdRef = useRef<string | null>(null);

  const recordImageReady = () => {
    if (
      performanceInteractionId === null ||
      recordedReadyInteractionIdRef.current === performanceInteractionId
    ) {
      return;
    }

    recordedReadyInteractionIdRef.current = performanceInteractionId;
    recordFrontendPerformanceAfterPaint("imageReady", {
      interactionId: performanceInteractionId,
      windowLabel: getCurrentWindowLabel() as PerformanceWindowLabel,
    });
  };

  useEffect(() => {
    if (image.status === "error") {
      void recordFrontendPerformance("imageError", {
        interactionId: performanceInteractionId,
        windowLabel: getCurrentWindowLabel() as PerformanceWindowLabel,
      });
    }
  }, [image.status, performanceInteractionId]);

  useEffect(() => {
    if (image.status === "ready" && imageElementRef.current?.complete) {
      recordImageReady();
    }
  }, [image.status, performanceInteractionId]);

  if (image.status === "error") {
    return errorFallback;
  }

  if (image.status !== "ready") {
    return loadingFallback;
  }

  return (
    <img
      alt={alt}
      className={className}
      draggable={false}
      onLoad={recordImageReady}
      ref={imageElementRef}
      src={image.src}
    />
  );
}
