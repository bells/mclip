import { APP_NAME } from "../constants";

import { Modal } from "./Modal";

type AboutDialogProps = {
  appVersion: string;
  onClose: () => void;
};

export function AboutDialog({ appVersion, onClose }: AboutDialogProps) {
  return (
    <Modal
      footer={
        <button className="app-modal-btn" onClick={onClose} type="button">
          确定
        </button>
      }
      onRequestClose={onClose}
      title={`关于 ${APP_NAME}`}
    >
      <h2 className="app-modal-app-name">{APP_NAME}</h2>
      <p className="app-modal-version">版本 {appVersion}</p>
      <p className="app-modal-description">
        一个轻量的跨平台剪贴板历史工具，基于 Tauri、React 和 Rust 构建。
      </p>
    </Modal>
  );
}
