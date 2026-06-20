// 独立偏好设置窗口：配置变更后立即写入，后端广播 settings-updated，主窗口同步刷新。

import { useEffect, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

import appIconUrl from "../../app-icon.png";
import lightMenuBarIconUrl from "../../src-tauri/icons/menu-bar-icon-light-128.png";
import {
  clampHistoryCount,
  DEFAULT_SETTINGS,
  MAX_MAX_HISTORY_COUNT,
  MIN_MAX_HISTORY_COUNT,
} from "../constants";
import { getTranslations } from "../i18n";
import {
  getCliInstallStatus,
  getSettings,
  hideCurrentWindow,
  installCli,
  listenToSettingsUpdated,
  openAutoPastePermissionSettings,
  saveSettings,
} from "../lib/tauri";
import type {
  AppLanguage,
  AppSettings,
  CliInstallStatus,
  HistoryKind,
  MenuBarIconStyle,
} from "../types";
import { normalizeSettings } from "../utils/settings";
import { DialogWindowControls } from "./DialogWindowControls";

type PreferencesTab = "general" | "storage" | "cli";

export function PreferencesWindow() {
  // settingsDraft 保留了旧命名，但现在每次控件变更都会立即写入后端。
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<PreferencesTab>("general");
  const [settingsError, setSettingsError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [cliStatus, setCliStatus] = useState<CliInstallStatus | null>(null);
  const [cliStatusError, setCliStatusError] = useState("");
  const [cliInstallMessage, setCliInstallMessage] = useState("");
  const [isInstallingCli, setIsInstallingCli] = useState(false);
  const latestSettingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const isMacOs = navigator.platform.toLowerCase().includes("mac");
  // 数字输入框单独保存字符串，允许用户编辑中间态，比如暂时清空输入框。
  const [maxHistoryCountInput, setMaxHistoryCountInput] = useState(
    String(DEFAULT_SETTINGS.maxHistoryCount),
  );
  const translations = getTranslations(settingsDraft.language);
  const t = translations.preferences;

  const syncSettingsState = (nextSettings: AppSettings) => {
    latestSettingsRef.current = nextSettings;
    setSettingsDraft(nextSettings);
    setMaxHistoryCountInput(String(nextSettings.maxHistoryCount));
  };

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

        syncSettingsState(loadedSettings);
        setSettingsError("");
      } catch (error) {
        console.error("加载偏好设置失败:", error);
      }
    };

    void loadSettings();
    void listenToSettingsUpdated((updatedSettings) => {
      const normalizedSettings = normalizeSettings(updatedSettings);
      syncSettingsState(normalizedSettings);
      setSettingsError("");
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadCliStatus = async () => {
      try {
        const status = await getCliInstallStatus();

        if (!isActive) {
          return;
        }

        setCliStatus(status);
        setCliStatusError("");
      } catch (error) {
        console.error("读取 mclip-cli 安装状态失败:", error);

        if (isActive) {
          setCliStatusError(t.cliStatusError);
        }
      }
    };

    void loadCliStatus();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void hideCurrentWindow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const applySettings = async (nextSettings: AppSettings) => {
    const previousSettings = latestSettingsRef.current;
    const normalizedSettings = normalizeSettings(nextSettings);

    syncSettingsState(normalizedSettings);
    setSettingsError("");
    setIsSavingSettings(true);

    try {
      const savedSettings = normalizeSettings(await saveSettings(normalizedSettings));
      syncSettingsState(savedSettings);
    } catch (error) {
      console.error("保存设置失败:", error);
      syncSettingsState(previousSettings);
      setSettingsError(t.error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const applySettingsPatch = (
    updater: (currentSettings: AppSettings) => AppSettings,
  ) => {
    void applySettings(updater(latestSettingsRef.current));
  };

  const toggleLaunchAtLogin = () => {
    applySettingsPatch((current) => ({
      ...current,
      launchAtLogin: !current.launchAtLogin,
    }));
  };

  const toggleAutoPaste = () => {
    applySettingsPatch((current) => ({
      ...current,
      autoPaste: !current.autoPaste,
    }));
  };

  const openAutoPastePermission = async () => {
    setSettingsError("");

    try {
      await openAutoPastePermissionSettings();
    } catch (error) {
      console.error("打开自动粘贴权限设置失败:", error);
      setSettingsError(t.autoPastePermissionOpenError);
    }
  };

  const updateLanguage = (language: AppLanguage) => {
    applySettingsPatch((current) => ({
      ...current,
      language,
    }));
  };

  const updateMenuBarIconStyle = (menuBarIconStyle: MenuBarIconStyle) => {
    applySettingsPatch((current) => ({
      ...current,
      menuBarIconStyle,
    }));
  };

  const toggleHistoryType = (kind: HistoryKind) => {
    applySettingsPatch((current) => ({
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

    setMaxHistoryCountInput(String(clampedValue));
    applySettingsPatch((current) => ({
      ...current,
      maxHistoryCount: clampedValue,
    }));
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

      const parsedValue = Number(value);

      if (
        value !== "" &&
        Number.isFinite(parsedValue) &&
        parsedValue >= MIN_MAX_HISTORY_COUNT &&
        parsedValue <= MAX_MAX_HISTORY_COUNT
      ) {
        const nextValue = Math.trunc(parsedValue);

        if (nextValue !== latestSettingsRef.current.maxHistoryCount) {
          applySettingsPatch((current) => ({
            ...current,
            maxHistoryCount: nextValue,
          }));
        }
      }
    }
  };

  const handleInstallCli = async () => {
    setCliInstallMessage("");
    setCliStatusError("");
    setIsInstallingCli(true);

    try {
      const status = await installCli();
      setCliStatus(status);
      setCliInstallMessage(t.cliInstallSuccess(status.installPath));
    } catch (error) {
      console.error("安装 mclip-cli 失败:", error);
      setCliStatusError(t.cliInstallError);
    } finally {
      setIsInstallingCli(false);
    }
  };

  const copyCliInstallCommand = async () => {
    if (!cliStatus) {
      return;
    }

    setCliInstallMessage("");
    setCliStatusError("");

    try {
      await navigator.clipboard.writeText(cliStatus.installCommand);
      setCliInstallMessage(t.cliCommandCopied);
    } catch (error) {
      console.error("复制 mclip-cli 安装命令失败:", error);
      setCliStatusError(t.cliCommandCopyError);
    }
  };

  return (
    <div className="app-dialog-frame app-preferences-window">
      <div className="app-dialog-panel app-settings-window-panel">
        <div className="app-dialog-titlebar" data-tauri-drag-region>
          <span className="app-modal-title">{t.title}</span>
          <DialogWindowControls labels={translations.windowControls} />
        </div>

        <div className="app-modal-content">
          <div className="app-settings-content">
            <div aria-label={t.tabsLabel} className="app-settings-tabs" role="tablist">
              {([
                ["general", t.generalTab],
                ["storage", t.storageTab],
                ["cli", t.cliTab],
              ] as const).map(([tab, label]) => (
                <button
                  aria-selected={activeTab === tab}
                  className={`app-settings-tab ${activeTab === tab ? "is-active" : ""}`}
                  disabled={isSavingSettings}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "general" ? (
              <div className="app-settings-tab-panel" role="tabpanel">
                <div className="app-settings-row">
                  <div className="app-settings-copy">
                    <div className="app-settings-label">{t.launchAtLoginLabel}</div>
                    <div className="app-settings-description">
                      {t.launchAtLoginDescription}
                    </div>
                  </div>

                  <button
                    aria-label={t.launchAtLoginLabel}
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
                    aria-label={t.languageLabel}
                    className="app-language-select"
                    disabled={isSavingSettings}
                    onChange={(event) => updateLanguage(event.target.value as AppLanguage)}
                    value={settingsDraft.language}
                  >
                    <option value="zhCn">{t.languageChinese}</option>
                    <option value="en">{t.languageEnglish}</option>
                  </select>
                </div>

                <div className="app-settings-section">
                  <div className="app-settings-section-heading">
                    <div className="app-settings-label">
                      {t.menuBarIconStyleLabel}
                    </div>
                    <div className="app-settings-description">
                      {t.menuBarIconStyleDescription}
                    </div>
                  </div>

                  <div
                    aria-label={t.menuBarIconStyleLabel}
                    className="app-menu-bar-icon-options"
                    role="radiogroup"
                  >
                    {([
                      [
                        "appIcon",
                        t.menuBarIconStyleAppIcon,
                        t.menuBarIconStyleAppIconDescription,
                        appIconUrl,
                      ],
                      [
                        "light",
                        t.menuBarIconStyleLight,
                        t.menuBarIconStyleLightDescription,
                        lightMenuBarIconUrl,
                      ],
                    ] as const).map(([style, label, description, iconUrl]) => (
                      <button
                        aria-checked={settingsDraft.menuBarIconStyle === style}
                        className={`app-menu-bar-icon-option ${
                          settingsDraft.menuBarIconStyle === style ? "is-selected" : ""
                        }`}
                        disabled={isSavingSettings}
                        key={style}
                        onClick={() => updateMenuBarIconStyle(style)}
                        role="radio"
                        type="button"
                      >
                        <span className="app-menu-bar-icon-preview">
                          <img src={iconUrl} alt="" aria-hidden="true" />
                        </span>
                        <span className="app-menu-bar-icon-copy">
                          <span className="app-menu-bar-icon-label">{label}</span>
                          <span className="app-menu-bar-icon-description">
                            {description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="app-settings-row">
                  <div className="app-settings-copy">
                    <div className="app-settings-label">{t.autoPasteLabel}</div>
                    <div className="app-settings-description">
                      {t.autoPasteDescription}
                    </div>
                    {isMacOs ? (
                      <div className="app-settings-note">
                        {t.autoPastePermissionNote}
                      </div>
                    ) : null}
                  </div>

                  <div className="app-settings-row-actions">
                    <button
                      aria-label={t.autoPasteLabel}
                      aria-pressed={settingsDraft.autoPaste}
                      className={`app-switch ${settingsDraft.autoPaste ? "is-on" : ""}`}
                      disabled={isSavingSettings}
                      onClick={toggleAutoPaste}
                      type="button"
                    >
                      <span className="app-switch-thumb" />
                    </button>

                    {isMacOs ? (
                      <button
                        className="app-settings-action-btn"
                        disabled={isSavingSettings}
                        onClick={openAutoPastePermission}
                        type="button"
                      >
                        {t.autoPastePermissionAction}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "storage" ? (
              <div className="app-settings-tab-panel" role="tabpanel">
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
                      aria-label={t.decreaseMaxHistoryCount}
                      className="app-stepper-btn"
                      disabled={isSavingSettings}
                      onClick={() =>
                        updateMaxHistoryCount(settingsDraft.maxHistoryCount - 1)
                      }
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
                      aria-label={t.increaseMaxHistoryCount}
                      className="app-stepper-btn"
                      disabled={isSavingSettings}
                      onClick={() =>
                        updateMaxHistoryCount(settingsDraft.maxHistoryCount + 1)
                      }
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
              </div>
            ) : null}

            {activeTab === "cli" ? (
              <div className="app-settings-tab-panel" role="tabpanel">
                <div className="app-settings-section app-cli-install-section">
                  <div className="app-settings-section-heading">
                    <div className="app-settings-label">{t.cliSectionLabel}</div>
                    <div className="app-settings-description">
                      {t.cliSectionDescription}
                    </div>
                  </div>

                  <div className="app-cli-status-row">
                    <div className="app-cli-status-copy">
                      <span
                        className={`app-cli-status-badge ${
                          cliStatus?.isInstalled ? "is-installed" : "is-missing"
                        }`}
                      >
                        {cliStatus
                          ? cliStatus.isInstalled
                            ? t.cliInstalled
                            : t.cliNotInstalled
                          : t.cliChecking}
                      </span>
                      <div className="app-settings-note">
                        {cliStatus
                          ? t.cliInstallPath(cliStatus.installPath)
                          : t.cliCheckingDescription}
                      </div>
                      {cliStatus && !cliStatus.isOnPath ? (
                        <div className="app-settings-note">
                          {t.cliPathNotOnPath(cliStatus.installDir)}
                        </div>
                      ) : null}
                      {cliStatus && !cliStatus.sourceAvailable ? (
                        <div className="app-settings-note">
                          {t.cliSourceUnavailable}
                        </div>
                      ) : null}
                    </div>

                    <button
                      className="app-cli-action-btn"
                      disabled={
                        isInstallingCli ||
                        !cliStatus ||
                        !cliStatus.sourceAvailable
                      }
                      onClick={handleInstallCli}
                      type="button"
                    >
                      {isInstallingCli
                        ? t.cliInstalling
                        : cliStatus?.sourceAvailable
                          ? cliStatus.isInstalled
                            ? t.cliReinstall
                            : t.cliInstall
                          : t.cliInstallUnavailable}
                    </button>
                  </div>

                  <div className="app-cli-command-row">
                    <code className="app-cli-command">
                      {cliStatus?.installCommand ?? t.cliChecking}
                    </code>
                    <button
                      className="app-cli-copy-btn"
                      disabled={!cliStatus}
                      onClick={copyCliInstallCommand}
                      type="button"
                    >
                      {t.cliCopyCommand}
                    </button>
                  </div>

                  {cliStatusError ? (
                    <div className="app-settings-error">{cliStatusError}</div>
                  ) : cliInstallMessage ? (
                    <div className="app-settings-status" aria-live="polite">
                      {cliInstallMessage}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {settingsError ? (
              <div className="app-settings-error">{settingsError}</div>
            ) : isSavingSettings ? (
              <div className="app-settings-status" aria-live="polite">
                {t.saving}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
