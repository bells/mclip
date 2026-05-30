// 通过 Tauri command 读取图片文件为 base64，用 data: URL 渲染，
// 绕过 asset protocol 的兼容性问题。

import { useEffect, useState } from "react";
import { getImageBase64 } from "../lib/tauri";

type ImageThumbProps = {
  alt: string;
  className: string;
  imagePath: string;
};

export function ImageThumb({ alt, className, imagePath }: ImageThumbProps) {
  // src 为 null 时先不渲染图片；等异步命令返回 base64 后再显示。
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // effect 里启动异步任务时，用 cancelled 避免组件卸载后继续 setState。
    void getImageBase64(imagePath).then((b64) => {
      if (!cancelled) {
        setSrc(`data:image/png;base64,${b64}`);
      }
    }).catch(() => {
      if (!cancelled) {
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  if (failed || !src) {
    // 加载失败或尚未加载完成时不渲染 img，避免出现破图图标。
    return null;
  }

  return (
    <img
      alt={alt}
      className={className}
      draggable={false}
      src={src}
    />
  );
}
