import type { MouseEvent, ReactNode } from "react";

import { startCurrentWindowDrag } from "../lib/tauri";
import { dialogFrame } from "../uiStyles";
import { shouldStartDialogWindowDrag } from "../utils/dialogDrag";

type DialogWindowFrameProps = {
  children: ReactNode;
  className: string;
};

export function DialogWindowFrame({ children, className }: DialogWindowFrameProps) {
  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !shouldStartDialogWindowDrag(event.target)) {
      return;
    }

    void startCurrentWindowDrag().catch((error: unknown) => {
      console.error("拖动对话窗口失败:", error);
    });
  };

  return (
    <div className={dialogFrame(className)} onMouseDown={handleMouseDown}>
      {children}
    </div>
  );
}
