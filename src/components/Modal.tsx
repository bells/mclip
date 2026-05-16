import type { PropsWithChildren, ReactNode } from "react";

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
