// 偏好设置弹窗：编辑登录启动、语言和最大历史条数。

import { useEffect, useState } from "react";

import {
  clampHistoryCount,
  MAX_MAX_HISTORY_COUNT,
  MIN_MAX_HISTORY_COUNT,
} from "../constants";
import type { AppTranslations } from "../i18n";
import type { AppLanguage, AppSettings } from "../types";

import { Modal } from "./Modal";

type PreferencesDialogProps = {
  errorMessage: string;
  isSaving: boolean;
  settings: AppSettings;
  translations: AppTranslations["preferences"];
  onClose: () => void;
  onSave: () => void;
  onToggleLaunchAtLogin: () => void;
  onUpdateLanguage: (language: AppLanguage) => void;
  onUpdateMaxHistoryCount: (value: number) => void;
};

export function PreferencesDialog({
  errorMessage,
  isSaving,
  settings,
  translations,
  onClose,
  onSave,
  onToggleLaunchAtLogin,
  onUpdateLanguage,
  onUpdateMaxHistoryCount,
}: PreferencesDialogProps) {
  const [maxHistoryCountInput, setMaxHistoryCountInput] = useState(
    String(settings.maxHistoryCount),
  );

  useEffect(() => {
    setMaxHistoryCountInput(String(settings.maxHistoryCount));
  }, [settings.maxHistoryCount]);

  const commitMaxHistoryCountInput = () => {
    const parsedValue = Number(maxHistoryCountInput);

    if (!Number.isFinite(parsedValue)) {
      setMaxHistoryCountInput(String(settings.maxHistoryCount));
      return;
    }

    const nextValue = clampHistoryCount(Math.trunc(parsedValue));
    // 手动输入在失焦或回车时提交，提交前统一裁剪到允许范围。
    setMaxHistoryCountInput(String(nextValue));
    onUpdateMaxHistoryCount(nextValue);
  };

  const updateMaxHistoryCountInput = (value: string) => {
    if (/^\d*$/.test(value)) {
      setMaxHistoryCountInput(value);
    }
  };

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
            {translations.cancel}
          </button>
          <button
            className="app-modal-btn"
            disabled={isSaving}
            onClick={onSave}
            type="button"
          >
            {isSaving ? translations.saving : translations.save}
          </button>
        </>
      }
      onRequestClose={onClose}
      title={translations.title}
    >
      <div className="app-settings-content">
        <div className="app-settings-row">
          <div className="app-settings-copy">
            <div className="app-settings-label">{translations.launchAtLoginLabel}</div>
            <div className="app-settings-description">
              {translations.launchAtLoginDescription}
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
            <div className="app-settings-label">{translations.languageLabel}</div>
            <div className="app-settings-description">
              {translations.languageDescription}
            </div>
          </div>

          <select
            className="app-language-select"
            disabled={isSaving}
            onChange={(event) => onUpdateLanguage(event.target.value as AppLanguage)}
            value={settings.language}
          >
            <option value="zhCn">{translations.languageChinese}</option>
            <option value="en">{translations.languageEnglish}</option>
          </select>
        </div>

        <div className="app-settings-row">
          <div className="app-settings-copy">
            <div className="app-settings-label">{translations.maxHistoryCountLabel}</div>
            <div className="app-settings-description">
              {translations.maxHistoryCountDescription}
            </div>
            <div className="app-settings-note">
              {translations.rangeNote(MIN_MAX_HISTORY_COUNT, MAX_MAX_HISTORY_COUNT)}
            </div>
          </div>

          <div className="app-stepper">
            <button
              className="app-stepper-btn"
              disabled={isSaving}
              onClick={() => onUpdateMaxHistoryCount(settings.maxHistoryCount - 1)}
              type="button"
            >
              -
            </button>
            <input
              aria-label={translations.maxHistoryCountAriaLabel}
              className="app-stepper-input"
              disabled={isSaving}
              max={MAX_MAX_HISTORY_COUNT}
              min={MIN_MAX_HISTORY_COUNT}
              onBlur={commitMaxHistoryCountInput}
              onChange={(event) => updateMaxHistoryCountInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              type="number"
              value={maxHistoryCountInput}
            />
            <button
              className="app-stepper-btn"
              disabled={isSaving}
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
