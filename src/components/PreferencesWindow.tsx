// 独立偏好设置窗口：编辑配置后由后端广播 settings-updated，主窗口同步刷新。

import { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

import {
  clampHistoryCount,
  DEFAULT_SETTINGS,
  MAX_MAX_HISTORY_COUNT,
  MIN_MAX_HISTORY_COUNT,
} from "../constants";
import { getTranslations } from "../i18n";
import {
  getSettings,
  hideCurrentWindow,
  listenToSettingsUpdated,
  saveSettings,
} from "../lib/tauri";
import type { AppLanguage, AppSettings, HistoryKind } from "../types";
import { normalizeSettings } from "../utils/settings";

export function PreferencesWindow() {
  // settingsDraft 是本窗口里的“草稿”，保存前不会直接写入后端。
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsError, setSettingsError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  // 数字输入框单独保存字符串，允许用户编辑中间态，比如暂时清空输入框。
  const [maxHistoryCountInput, setMaxHistoryCountInput] = useState(
    String(DEFAULT_SETTINGS.maxHistoryCount),
  );
  const t = getTranslations(settingsDraft.language).preferences;

  useEffect(() => {
    let isActive = true;
    let unlisten: UnlistenFn | undefined;

    const loadSettings = async () => {
      try {
        const loadedSettings = normalizeSettings(await getSettings());

        // 如果异步请求回来时组件已经卸载，就不要再 setState。
        if (!isActive) {
          return;
        }

        setSettingsDraft(loadedSettings);
        setSettingsError("");
        setMaxHistoryCountInput(String(loadedSettings.maxHistoryCount));
      } catch (error) {
        console.error("加载偏好设置失败:", error);
      }
    };

    void loadSettings();
    void listenToSettingsUpdated((updatedSettings) => {
      const normalizedSettings = normalizeSettings(updatedSettings);
      setSettingsDraft(normalizedSettings);
      setSettingsError("");
      setMaxHistoryCountInput(String(normalizedSettings.maxHistoryCount));
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSavingSettings) {
        event.preventDefault();
        void hideCurrentWindow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSavingSettings]);

  const toggleLaunchAtLogin = () => {
    setSettingsDraft((current) => ({
      ...current,
      launchAtLogin: !current.launchAtLogin,
    }));
  };

  const updateLanguage = (language: AppLanguage) => {
    setSettingsDraft((current) => ({
      ...current,
      language,
    }));
  };

  const toggleHistoryType = (kind: HistoryKind) => {
    setSettingsDraft((current) => ({
      ...current,
      enabledHistoryTypes: {
        ...current.enabledHistoryTypes,
        // 计算属性名：用变量 kind 的值作为对象 key，比如 "text" / "image" / "files"。
        [kind]: !current.enabledHistoryTypes[kind],
      },
    }));
  };

  const updateMaxHistoryCount = (nextValue: number) => {
    const clampedValue = clampHistoryCount(nextValue);

    setSettingsDraft((current) => ({
      ...current,
      maxHistoryCount: clampedValue,
    }));
    setMaxHistoryCountInput(String(clampedValue));
  };

  const commitMaxHistoryCountInput = () => {
    const parsedValue = Number(maxHistoryCountInput);

    if (!Number.isFinite(parsedValue)) {
      // 输入不是有效数字时回退到当前草稿值，避免把 NaN 写进设置。
      setMaxHistoryCountInput(String(settingsDraft.maxHistoryCount));
      return;
    }

    updateMaxHistoryCount(Math.trunc(parsedValue));
  };

  const updateMaxHistoryCountInput = (value: string) => {
    if (/^\d*$/.test(value)) {
      setMaxHistoryCountInput(value);
    }
  };

  const savePreferences = async () => {
    try {
      setIsSavingSettings(true);
      setSettingsError("");

      const savedSettings = normalizeSettings(
        await saveSettings(normalizeSettings(settingsDraft)),
      );

      setSettingsDraft(savedSettings);
      setMaxHistoryCountInput(String(savedSettings.maxHistoryCount));
      await hideCurrentWindow();
    } catch (error) {
      console.error("保存设置失败:", error);
      setSettingsError(t.error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="app-dialog-frame app-preferences-window">
      <div className="app-dialog-panel app-settings-window-panel">
        <div className="app-modal-header">
          <span className="app-modal-title">{t.title}</span>
        </div>

        <div className="app-modal-content">
          <div className="app-settings-content">
            <div className="app-settings-row">
              <div className="app-settings-copy">
                <div className="app-settings-label">{t.launchAtLoginLabel}</div>
                <div className="app-settings-description">
                  {t.launchAtLoginDescription}
                </div>
              </div>

              <button
                aria-pressed={settingsDraft.launchAtLogin}
                className={`app-switch ${settingsDraft.launchAtLogin ? "is-on" : ""}`}
                disabled={isSavingSettings}
                onClick={toggleLaunchAtLogin}
                type="button"
              >
                <span className="app-switch-thumb" />
              </button>
            </div>

            <div className="app-settings-row">
              <div className="app-settings-copy">
                <div className="app-settings-label">{t.languageLabel}</div>
                <div className="app-settings-description">{t.languageDescription}</div>
              </div>

              <select
                className="app-language-select"
                disabled={isSavingSettings}
                onChange={(event) => updateLanguage(event.target.value as AppLanguage)}
                value={settingsDraft.language}
              >
                <option value="zhCn">{t.languageChinese}</option>
                <option value="en">{t.languageEnglish}</option>
              </select>
            </div>

            <div className="app-settings-row">
              <div className="app-settings-copy">
                <div className="app-settings-label">{t.maxHistoryCountLabel}</div>
                <div className="app-settings-description">
                  {t.maxHistoryCountDescription}
                </div>
                <div className="app-settings-note">
                  {t.rangeNote(MIN_MAX_HISTORY_COUNT, MAX_MAX_HISTORY_COUNT)}
                </div>
              </div>

              <div className="app-stepper">
                <button
                  className="app-stepper-btn"
                  disabled={isSavingSettings}
                  onClick={() => updateMaxHistoryCount(settingsDraft.maxHistoryCount - 1)}
                  type="button"
                >
                  -
                </button>
                <input
                  aria-label={t.maxHistoryCountAriaLabel}
                  className="app-stepper-input"
                  disabled={isSavingSettings}
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
                  disabled={isSavingSettings}
                  onClick={() => updateMaxHistoryCount(settingsDraft.maxHistoryCount + 1)}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>

            <div className="app-settings-section">
              <div className="app-settings-section-heading">
                <div className="app-settings-label">{t.typesLabel}</div>
                <div className="app-settings-description">{t.typesDescription}</div>
              </div>

              <div className="app-history-type-list">
                {/* `as const` 让 TypeScript 把 kind 推断成字面量类型，而不是普通 string。 */}
                {([
                  ["text", t.typeText],
                  ["image", t.typeImage],
                  ["files", t.typeFiles],
                ] as const).map(([kind, label]) => (
                  <button
                    aria-pressed={settingsDraft.enabledHistoryTypes[kind]}
                    className={`app-history-type-row ${
                      settingsDraft.enabledHistoryTypes[kind] ? "is-on" : ""
                    }`}
                    disabled={isSavingSettings}
                    key={kind}
                    onClick={() => toggleHistoryType(kind)}
                    type="button"
                  >
                    <span className="app-history-type-label">{label}</span>
                    <span className="app-history-type-check" />
                  </button>
                ))}
              </div>
            </div>

            {settingsError ? (
              <div className="app-settings-error">{settingsError}</div>
            ) : null}
          </div>
        </div>

        <div className="app-modal-footer">
          <button
            className="app-modal-secondary-btn"
            disabled={isSavingSettings}
            onClick={() => {
              void hideCurrentWindow();
            }}
            type="button"
          >
            {t.cancel}
          </button>
          <button
            className="app-modal-btn"
            disabled={isSavingSettings}
            onClick={() => {
              void savePreferences();
            }}
            type="button"
          >
            {isSavingSettings ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
