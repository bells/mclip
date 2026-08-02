// 通过 Tauri command 读取图片文件为 base64，用 data: URL 渲染，
// 绕过 asset protocol 的兼容性问题。

import { useImageDataUrl } from "../hooks/useImageDataUrl";

type ImageThumbProps = {
  alt: string;
  className: string;
  imagePath: string;
};

export function ImageThumb({ alt, className, imagePath }: ImageThumbProps) {
  const image = useImageDataUrl(imagePath);

  if (image.status !== "ready") {
    // 加载失败或尚未加载完成时不渲染 img，避免出现破图图标。
    return null;
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
