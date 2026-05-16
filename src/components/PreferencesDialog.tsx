import {
  MAX_MAX_HISTORY_COUNT,
  MIN_MAX_HISTORY_COUNT,
} from "../constants";
import type { AppSettings } from "../types";

import { Modal } from "./Modal";

type PreferencesDialogProps = {
  errorMessage: string;
  isSaving: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: () => void;
  onToggleLaunchAtLogin: () => void;
  onUpdateMaxHistoryCount: (value: number) => void;
};

export function PreferencesDialog({
  errorMessage,
  isSaving,
  settings,
  onClose,
  onSave,
  onToggleLaunchAtLogin,
  onUpdateMaxHistoryCount,
}: PreferencesDialogProps) {
  return (
    <Modal
      className="app-settings-modal"
      footer={
        <>
          <button
            className="app-modal-secondary-btn"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="app-modal-btn"
            disabled={isSaving}
            onClick={onSave}
            type="button"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </>
      }
      onRequestClose={onClose}
      title="偏好设置"
    >
      <div className="app-settings-content">
        <div className="app-settings-row">
          <div className="app-settings-copy">
            <div className="app-settings-label">登录时启动</div>
            <div className="app-settings-description">
              在系统登录后自动启动 mclip。
            </div>
          </div>

          <button
            aria-pressed={settings.launchAtLogin}
            className={`app-switch ${settings.launchAtLogin ? "is-on" : ""}`}
            onClick={onToggleLaunchAtLogin}
            type="button"
          >
            <span className="app-switch-thumb" />
          </button>
        </div>

        <div className="app-settings-row">
          <div className="app-settings-copy">
            <div className="app-settings-label">最大记录条数</div>
            <div className="app-settings-description">
              控制本地历史列表最多保留多少条文本记录。
            </div>
            <div className="app-settings-note">
              可选范围 {MIN_MAX_HISTORY_COUNT} - {MAX_MAX_HISTORY_COUNT}
            </div>
          </div>

          <div className="app-stepper">
            <button
              className="app-stepper-btn"
              onClick={() => onUpdateMaxHistoryCount(settings.maxHistoryCount - 1)}
              type="button"
            >
              -
            </button>
            <input
              aria-label="最大记录条数"
              className="app-stepper-input"
              readOnly
              type="number"
              value={settings.maxHistoryCount}
            />
            <button
              className="app-stepper-btn"
              onClick={() => onUpdateMaxHistoryCount(settings.maxHistoryCount + 1)}
              type="button"
            >
              +
            </button>
          </div>
        </div>

        {errorMessage ? <div className="app-settings-error">{errorMessage}</div> : null}
      </div>
    </Modal>
  );
}
