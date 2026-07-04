// 通用模态框骨架：点击遮罩关闭，点击内容区阻止冒泡。

import type { PropsWithChildren, ReactNode } from "react";

import { ui } from "../uiStyles";

// PropsWithChildren 会把 children 加进 props 类型，ReactNode 可表示任意可渲染内容。
type ModalProps = PropsWithChildren<{
  className?: string;
  footer?: ReactNode;
  onRequestClose: () => void;
  title: string;
}>;

export function Modal({
  children,
  className,
  footer,
  onRequestClose,
  title,
}: ModalProps) {
  return (
    <div className={ui.modalOverlay} onClick={onRequestClose}>
      <div
        aria-modal="true"
        // filter(Boolean) 去掉 undefined class，再 join 成浏览器需要的 className 字符串。
        className={[ui.modal, className].filter(Boolean).join(" ")}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={ui.modalHeader}>
          <span className={ui.modalTitle}>{title}</span>
        </div>

        <div className={ui.modalContent}>{children}</div>

        {footer ? <div className={ui.modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}
