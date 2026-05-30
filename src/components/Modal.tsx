// 通用模态框骨架：点击遮罩关闭，点击内容区阻止冒泡。

import type { PropsWithChildren, ReactNode } from "react";

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
    <div className="app-modal-overlay" onClick={onRequestClose}>
      <div
        aria-modal="true"
        // filter(Boolean) 去掉 undefined class，再 join 成浏览器需要的 className 字符串。
        className={["app-modal", className].filter(Boolean).join(" ")}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="app-modal-header">
          <span className="app-modal-title">{title}</span>
        </div>

        <div className="app-modal-content">{children}</div>

        {footer ? <div className="app-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
