// 通过 Tauri command 读取图片文件为 base64，用 data: URL 渲染，
// 绕过 asset protocol 的兼容性问题。

import type { ReactNode } from "react";

import { useImageDataUrl } from "../hooks/useImageDataUrl";

type ImageThumbProps = {
  alt: string;
  className: string;
  errorFallback?: ReactNode;
  imagePath: string;
  loadingFallback?: ReactNode;
};

export function ImageThumb({
  alt,
  className,
  errorFallback = null,
  imagePath,
  loadingFallback = null,
}: ImageThumbProps) {
  const image = useImageDataUrl(imagePath);

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
      src={image.src}
    />
  );
}
