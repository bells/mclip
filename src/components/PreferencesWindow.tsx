// 独立偏好设置窗口：配置变更后立即写入，后端广播 settings-updated，主窗口同步刷新。

import { useEffect, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

import appIconUrl from "../../app-icon.png";
import lightMenuBarIconUrl from "../../src-tauri/icons/menu-bar-icon-light-128.png";
import {
  clampHistoryGroupItemCount,
  clampHistoryCount,
  clampMainWindowItemCount,
  DEFAULT_SETTINGS,
  MAX_MAX_HISTORY_COUNT,
  MAX_VISIBLE_ITEM_COUNT,
  MIN_MAX_HISTORY_COUNT,
  MIN_VISIBLE_ITEM_COUNT,
} from "../constants";
import { useApplyAppTheme } from "../hooks/useApplyAppTheme";
import { getTranslations } from "../i18n";
import {
  getCliInstallStatus,
  getAutoPastePermissionStatus,
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
  AppearanceTheme,
  AutoPastePermissionStatus,
  CliInstallStatus,
  HistoryKind,
  MenuBarIconStyle,
} from "../types";
import {
  historyTypeRow,
  settingsTab,
  switchControl,
  switchThumb,
  ui,
} from "../uiStyles";
import { normalizeSettings } from "../utils/settings";
import { DialogStatusBar } from "./DialogStatusBar";
import { DialogWindowFrame } from "./DialogWindowFrame";
import { CheckIcon } from "./UiIcons";

type PreferencesTab = "general" | "storage" | "cli";
type VisibleItemCountSetting = "mainWindowItemCount" | "historyGroupItemCount";

export function PreferencesWindow() {
  // settingsDraft 保留了旧命名，但现在每次控件变更都会立即写入后端。
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<PreferencesTab>("general");
  const [settingsError, setSettingsError] = useState("");
  const [autoPastePermissionStatus, setAutoPastePermissionStatus] =
    useState<AutoPastePermissionStatus | null>(null);
  const [isCheckingAutoPastePermission, setIsCheckingAutoPastePermission] =
    useState(false);
  const [cliStatus, setCliStatus] = useState<CliInstallStatus | null>(null);
  const [cliStatusError, setCliStatusError] = useState("");
  const [cliInstallMessage, setCliInstallMessage] = useState("");
  const [isInstallingCli, setIsInstallingCli] = useState(false);
  const latestSettingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const pendingSettingsSaveCountRef = useRef(0);
  const settingsSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const settingsSaveRevisionRef = useRef(0);
  const isMacOs = navigator.platform.toLowerCase().includes("mac");
  // 数字输入框单独保存字符串，允许用户编辑中间态，比如暂时清空输入框。
  const [maxHistoryCountInput, setMaxHistoryCountInput] = useState(
    String(DEFAULT_SETTINGS.maxHistoryCount),
  );
  const [visibleItemCountInputs, setVisibleItemCountInputs] = useState<
    Record<VisibleItemCountSetting, string>
  >({
    historyGroupItemCount: String(DEFAULT_SETTINGS.historyGroupItemCount),
    mainWindowItemCount: String(DEFAULT_SETTINGS.mainWindowItemCount),
  });
  const translations = getTranslations(settingsDraft.language);
  useApplyAppTheme(settingsDraft.appearanceTheme);
  const t = translations.preferences;
  const selectedMenuBarIconUrl =
    settingsDraft.menuBarIconStyle === "light" ? lightMenuBarIconUrl : appIconUrl;
  const mainWindowItemCountMax = settingsDraft.maxHistoryCount;

  const syncSettingsState = (nextSettings: AppSettings) => {
    latestSettingsRef.current = nextSettings;
    setSettingsDraft(nextSettings);
    setMaxHistoryCountInput(String(nextSettings.maxHistoryCount));
    setVisibleItemCountInputs({
      historyGroupItemCount: String(nextSettings.historyGroupItemCount),
      mainWindowItemCount: String(nextSettings.mainWindowItemCount),
    });
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
      if (pendingSettingsSaveCountRef.current > 0) {
        return;
      }

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
    if (!isMacOs) {
      return;
    }

    let isActive = true;

    const loadAutoPastePermissionStatus = async () => {
      setIsCheckingAutoPastePermission(true);

      try {
        const status = await getAutoPastePermissionStatus();

        if (isActive) {
          setAutoPastePermissionStatus(status);
        }
      } catch (error) {
        console.error("检查自动粘贴权限失败:", error);
      } finally {
        if (isActive) {
          setIsCheckingAutoPastePermission(false);
        }
      }
    };

    void loadAutoPastePermissionStatus();

    return () => {
      isActive = false;
    };
  }, [isMacOs]);

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

  const applySettings = (nextSettings: AppSettings) => {
    const previousSettings = latestSettingsRef.current;
    const normalizedSettings = normalizeSettings(nextSettings);
    const saveRevision = settingsSaveRevisionRef.current + 1;

    settingsSaveRevisionRef.current = saveRevision;
    pendingSettingsSaveCountRef.current += 1;
    syncSettingsState(normalizedSettings);
    setSettingsError("");

    const saveTask = settingsSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const savedSettings = normalizeSettings(await saveSettings(normalizedSettings));

          if (settingsSaveRevisionRef.current === saveRevision) {
            syncSettingsState(savedSettings);
            setSettingsError("");
          }
        } catch (error) {
          console.error("保存设置失败:", error);

          if (settingsSaveRevisionRef.current === saveRevision) {
            syncSettingsState(previousSettings);
            setSettingsError(t.error);
          }
        } finally {
          pendingSettingsSaveCountRef.current = Math.max(
            0,
            pendingSettingsSaveCountRef.current - 1,
          );
        }
      });

    settingsSaveQueueRef.current = saveTask;
  };

  const applySettingsPatch = (
    updater: (currentSettings: AppSettings) => AppSettings,
  ) => {
    void applySettings(updater(latestSettingsRef.current));
  };

  const refreshAutoPastePermissionStatus = async () => {
    if (!isMacOs) {
      return null;
    }

    setIsCheckingAutoPastePermission(true);

    try {
      const status = await getAutoPastePermissionStatus();
      setAutoPastePermissionStatus(status);
      return status;
    } catch (error) {
      console.error("检查自动粘贴权限失败:", error);
      setSettingsError(t.autoPastePermissionOpenError);
      return null;
    } finally {
      setIsCheckingAutoPastePermission(false);
    }
  };

  const toggleLaunchAtLogin = () => {
    applySettingsPatch((current) => ({
      ...current,
      launchAtLogin: !current.launchAtLogin,
    }));
  };

  const toggleAutoPaste = async () => {
    const currentSettings = latestSettingsRef.current;

    if (currentSettings.autoPaste) {
      applySettingsPatch((current) => ({
        ...current,
        autoPaste: false,
      }));
      return;
    }

    if (isMacOs) {
      const permissionStatus = await refreshAutoPastePermissionStatus();

      if (!permissionStatus) {
        return;
      }

      if (permissionStatus?.requiresPermission && !permissionStatus.isGranted) {
        setSettingsError(t.autoPastePermissionRequiredToEnable);

        try {
          await openAutoPastePermissionSettings();
          void refreshAutoPastePermissionStatus();
        } catch (error) {
          console.error("打开自动粘贴权限设置失败:", error);
          setSettingsError(t.autoPastePermissionOpenError);
        }

        return;
      }
    }

    applySettingsPatch((current) => ({
      ...current,
      autoPaste: true,
    }));
  };

  const openAutoPastePermission = async () => {
    setSettingsError("");

    try {
      await openAutoPastePermissionSettings();
      void refreshAutoPastePermissionStatus();
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

  const updateAppearanceTheme = (appearanceTheme: AppearanceTheme) => {
    applySettingsPatch((current) => ({
      ...current,
      appearanceTheme,
    }));
  };

  const toggleHistoryItemNumbers = () => {
    applySettingsPatch((current) => ({
      ...current,
      showHistoryItemNumbers: !current.showHistoryItemNumbers,
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
      mainWindowItemCount: clampMainWindowItemCount(
        current.mainWindowItemCount,
        clampedValue,
      ),
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
            mainWindowItemCount: clampMainWindowItemCount(
              current.mainWindowItemCount,
              nextValue,
            ),
          }));
        }
      }
    }
  };

  const clampVisibleItemCountForSetting = (
    settingKey: VisibleItemCountSetting,
    nextValue: number,
  ) =>
    settingKey === "mainWindowItemCount"
      ? clampMainWindowItemCount(
          nextValue,
          latestSettingsRef.current.maxHistoryCount,
        )
      : clampHistoryGroupItemCount(nextValue);

  const getVisibleItemCountMax = (settingKey: VisibleItemCountSetting) =>
    settingKey === "mainWindowItemCount"
      ? latestSettingsRef.current.maxHistoryCount
      : MAX_VISIBLE_ITEM_COUNT;

  const updateVisibleItemCount = (
    settingKey: VisibleItemCountSetting,
    nextValue: number,
  ) => {
    const clampedValue = clampVisibleItemCountForSetting(settingKey, nextValue);

    setVisibleItemCountInputs((current) => ({
      ...current,
      [settingKey]: String(clampedValue),
    }));
    applySettingsPatch((current) => ({
      ...current,
      [settingKey]: clampedValue,
    }));
  };

  const commitVisibleItemCountInput = (settingKey: VisibleItemCountSetting) => {
    const parsedValue = Number(visibleItemCountInputs[settingKey]);

    if (!Number.isFinite(parsedValue)) {
      setVisibleItemCountInputs((current) => ({
        ...current,
        [settingKey]: String(settingsDraft[settingKey]),
      }));
      return;
    }

    updateVisibleItemCount(settingKey, Math.trunc(parsedValue));
  };

  const updateVisibleItemCountInput = (
    settingKey: VisibleItemCountSetting,
    value: string,
  ) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    setVisibleItemCountInputs((current) => ({
      ...current,
      [settingKey]: value,
    }));

    const parsedValue = Number(value);
    const maxValue = getVisibleItemCountMax(settingKey);

    if (
      value !== "" &&
      Number.isFinite(parsedValue) &&
      parsedValue >= MIN_VISIBLE_ITEM_COUNT &&
      parsedValue <= maxValue
    ) {
      const nextValue = Math.trunc(parsedValue);

      if (nextValue !== latestSettingsRef.current[settingKey]) {
        applySettingsPatch((current) => ({
          ...current,
          [settingKey]: nextValue,
        }));
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
    <DialogWindowFrame className={ui.preferencesWindowFrame}>
      <div className={`${ui.dialogPanel} ${ui.settingsWindowPanel}`}>
        <DialogStatusBar
          controlsLabels={translations.windowControls}
          title={t.title}
        />

        <div className={ui.dialogContent}>
          <div className={ui.settingsContent}>
            <div aria-label={t.tabsLabel} className={ui.settingsTabs} role="tablist">
              {([
                ["general", t.generalTab],
                ["storage", t.storageTab],
                ["cli", t.cliTab],
              ] as const).map(([tab, label]) => (
                  <button
                    aria-selected={activeTab === tab}
                    className={settingsTab(activeTab === tab)}
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
              <div className={ui.settingsTabPanel} role="tabpanel">
                <div className={ui.settingsPrimaryGrid}>
                  <div className={ui.settingsCompactField}>
                    <div className={ui.settingsLabel}>{t.languageLabel}</div>
                    <select
                      aria-label={t.languageLabel}
                      className={`${ui.settingsSelect} ${ui.languageSelect}`}
                      onChange={(event) => updateLanguage(event.target.value as AppLanguage)}
                      value={settingsDraft.language}
                    >
                      <option value="zhCn">{t.languageChinese}</option>
                      <option value="en">{t.languageEnglish}</option>
                    </select>
                  </div>

                  <div className={ui.settingsCompactField}>
                    <div className={ui.settingsLabel}>{t.menuBarIconStyleLabel}</div>
                    <div className={ui.menuBarIconSelect}>
                      <span
                        aria-hidden="true"
                        className={ui.menuBarIconSelectPreview}
                      >
                        <img
                          className={ui.menuBarIconSelectImage}
                          src={selectedMenuBarIconUrl}
                          alt=""
                        />
                      </span>
                      <select
                        aria-label={t.menuBarIconStyleLabel}
                        className={ui.menuBarIconSelectControl}
                        onChange={(event) =>
                          updateMenuBarIconStyle(
                            event.target.value as MenuBarIconStyle,
                          )
                        }
                        value={settingsDraft.menuBarIconStyle}
                      >
                        <option value="appIcon">{t.menuBarIconStyleAppIcon}</option>
                        <option value="light">{t.menuBarIconStyleLight}</option>
                      </select>
                    </div>
                  </div>

                  <div className={ui.settingsCompactField}>
                    <div className={ui.settingsLabel}>{t.appearanceThemeLabel}</div>
                    <select
                      aria-label={t.appearanceThemeLabel}
                      className={ui.settingsSelect}
                      onChange={(event) =>
                        updateAppearanceTheme(event.target.value as AppearanceTheme)
                      }
                      value={settingsDraft.appearanceTheme}
                    >
                      <option value="system">{t.appearanceThemeSystem}</option>
                      <option value="light">{t.appearanceThemeLight}</option>
                      <option value="dark">{t.appearanceThemeDark}</option>
                    </select>
                  </div>
                </div>

                <div className={ui.settingsRow}>
                  <div className={ui.settingsCopy}>
                    <div className={ui.settingsLabel}>{t.launchAtLoginLabel}</div>
                    <div className={ui.settingsDescription}>
                      {t.launchAtLoginDescription}
                    </div>
                  </div>

                  <button
                    aria-label={t.launchAtLoginLabel}
                    aria-pressed={settingsDraft.launchAtLogin}
                    className={switchControl(settingsDraft.launchAtLogin)}
                    onClick={toggleLaunchAtLogin}
                    type="button"
                  >
                    <span className={switchThumb(settingsDraft.launchAtLogin)} />
                  </button>
                </div>

                <div className={ui.settingsRow}>
                  <div className={ui.settingsCopy}>
                    <div className={ui.settingsLabel}>{t.autoPasteLabel}</div>
                    <div className={ui.settingsDescription}>
                      {t.autoPasteDescription}
                    </div>
                    {isMacOs ? (
                      <div className={ui.settingsNote}>
                        {t.autoPastePermissionNote}
                      </div>
                    ) : null}
                    {isMacOs && autoPastePermissionStatus ? (
                      <div
                        className={`${ui.settingsNote} ${
                          autoPastePermissionStatus.isGranted
                            ? ui.settingsNoteOk
                            : ui.settingsNoteWarning
                        }`}
                      >
                        {autoPastePermissionStatus.isGranted
                          ? t.autoPastePermissionGranted
                          : t.autoPastePermissionStatus(autoPastePermissionStatus.appPath)}
                      </div>
                    ) : null}
                  </div>

                  <div className={ui.settingsRowActions}>
                    <button
                      aria-label={t.autoPasteLabel}
                      aria-pressed={settingsDraft.autoPaste}
                      className={switchControl(settingsDraft.autoPaste)}
                      disabled={isCheckingAutoPastePermission}
                      onClick={() => void toggleAutoPaste()}
                      type="button"
                    >
                      <span className={switchThumb(settingsDraft.autoPaste)} />
                    </button>

                    {isMacOs ? (
                      <button
                        className={ui.settingsActionButton}
                        onClick={openAutoPastePermission}
                        type="button"
                      >
                        {t.autoPastePermissionAction}
                      </button>
                    ) : null}

                    {isMacOs ? (
                      <button
                        className={ui.settingsActionButton}
                        disabled={isCheckingAutoPastePermission}
                        onClick={() => void refreshAutoPastePermissionStatus()}
                        type="button"
                      >
                        {t.autoPastePermissionRefreshAction}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "storage" ? (
              <div className={ui.settingsTabPanel} role="tabpanel">
                <div className={ui.settingsRow}>
                  <div className={ui.settingsCopy}>
                    <div className={ui.settingsLabel}>{t.maxHistoryCountLabel}</div>
                    <div className={ui.settingsDescription}>
                      {t.maxHistoryCountDescription}
                    </div>
                    <div className={ui.settingsNote}>
                      {t.rangeNote(MIN_MAX_HISTORY_COUNT, MAX_MAX_HISTORY_COUNT)}
                    </div>
                  </div>

                  <div className={ui.stepper}>
                    <button
                      aria-label={t.decreaseMaxHistoryCount}
                      className={ui.stepperButton}
                      onClick={() =>
                        updateMaxHistoryCount(settingsDraft.maxHistoryCount - 1)
                      }
                      type="button"
                    >
                      -
                    </button>
                    <input
                      aria-label={t.maxHistoryCountAriaLabel}
                      className={ui.stepperInput}
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
                      className={ui.stepperButton}
                      onClick={() =>
                        updateMaxHistoryCount(settingsDraft.maxHistoryCount + 1)
                      }
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={ui.settingsRow}>
                  <div className={ui.settingsCopy}>
                    <div className={ui.settingsLabel}>
                      {t.mainWindowItemCountLabel}
                    </div>
                    <div className={ui.settingsDescription}>
                      {t.mainWindowItemCountDescription}
                    </div>
                    <div className={ui.settingsNote}>
                      {t.rangeNote(MIN_VISIBLE_ITEM_COUNT, mainWindowItemCountMax)}
                    </div>
                  </div>

                  <div className={ui.stepper}>
                    <button
                      aria-label={t.decreaseMainWindowItemCount}
                      className={ui.stepperButton}
                      onClick={() =>
                        updateVisibleItemCount(
                          "mainWindowItemCount",
                          settingsDraft.mainWindowItemCount - 1,
                        )
                      }
                      type="button"
                    >
                      -
                    </button>
                    <input
                      aria-label={t.mainWindowItemCountAriaLabel}
                      className={ui.stepperInput}
                      max={mainWindowItemCountMax}
                      min={MIN_VISIBLE_ITEM_COUNT}
                      onBlur={() =>
                        commitVisibleItemCountInput("mainWindowItemCount")
                      }
                      onChange={(event) =>
                        updateVisibleItemCountInput(
                          "mainWindowItemCount",
                          event.target.value,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      type="number"
                      value={visibleItemCountInputs.mainWindowItemCount}
                    />
                    <button
                      aria-label={t.increaseMainWindowItemCount}
                      className={ui.stepperButton}
                      onClick={() =>
                        updateVisibleItemCount(
                          "mainWindowItemCount",
                          settingsDraft.mainWindowItemCount + 1,
                        )
                      }
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={ui.settingsRow}>
                  <div className={ui.settingsCopy}>
                    <div className={ui.settingsLabel}>
                      {t.historyGroupItemCountLabel}
                    </div>
                    <div className={ui.settingsDescription}>
                      {t.historyGroupItemCountDescription}
                    </div>
                    <div className={ui.settingsNote}>
                      {t.rangeNote(MIN_VISIBLE_ITEM_COUNT, MAX_VISIBLE_ITEM_COUNT)}
                    </div>
                  </div>

                  <div className={ui.stepper}>
                    <button
                      aria-label={t.decreaseHistoryGroupItemCount}
                      className={ui.stepperButton}
                      onClick={() =>
                        updateVisibleItemCount(
                          "historyGroupItemCount",
                          settingsDraft.historyGroupItemCount - 1,
                        )
                      }
                      type="button"
                    >
                      -
                    </button>
                    <input
                      aria-label={t.historyGroupItemCountAriaLabel}
                      className={ui.stepperInput}
                      max={MAX_VISIBLE_ITEM_COUNT}
                      min={MIN_VISIBLE_ITEM_COUNT}
                      onBlur={() =>
                        commitVisibleItemCountInput("historyGroupItemCount")
                      }
                      onChange={(event) =>
                        updateVisibleItemCountInput(
                          "historyGroupItemCount",
                          event.target.value,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      type="number"
                      value={visibleItemCountInputs.historyGroupItemCount}
                    />
                    <button
                      aria-label={t.increaseHistoryGroupItemCount}
                      className={ui.stepperButton}
                      onClick={() =>
                        updateVisibleItemCount(
                          "historyGroupItemCount",
                          settingsDraft.historyGroupItemCount + 1,
                        )
                      }
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={ui.settingsRow}>
                  <div className={ui.settingsCopy}>
                    <div className={ui.settingsLabel}>
                      {t.showHistoryItemNumbersLabel}
                    </div>
                    <div className={ui.settingsDescription}>
                      {t.showHistoryItemNumbersDescription}
                    </div>
                  </div>

                  <button
                    aria-label={t.showHistoryItemNumbersLabel}
                    aria-pressed={settingsDraft.showHistoryItemNumbers}
                    className={switchControl(settingsDraft.showHistoryItemNumbers)}
                    onClick={toggleHistoryItemNumbers}
                    type="button"
                  >
                    <span className={switchThumb(settingsDraft.showHistoryItemNumbers)} />
                  </button>
                </div>

                <div className={ui.settingsSection}>
                  <div className={ui.settingsSectionHeading}>
                    <div className={ui.settingsLabel}>{t.typesLabel}</div>
                    <div className={ui.settingsDescription}>{t.typesDescription}</div>
                  </div>

                  <div className={ui.historyTypeList}>
                    {/* `as const` 让 TypeScript 把 kind 推断成字面量类型，而不是普通 string。 */}
                    {([
                      ["text", t.typeText],
                      ["image", t.typeImage],
                      ["files", t.typeFiles],
                    ] as const).map(([kind, label]) => (
                      <button
                        aria-pressed={settingsDraft.enabledHistoryTypes[kind]}
                        className={historyTypeRow(settingsDraft.enabledHistoryTypes[kind])}
                        key={kind}
                        onClick={() => toggleHistoryType(kind)}
                        type="button"
                      >
                        <span className={ui.historyTypeLabel}>{label}</span>
                        <span className={ui.historyTypeCheck}>
                          {settingsDraft.enabledHistoryTypes[kind] ? (
                            <CheckIcon className="size-3.5" />
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "cli" ? (
              <div className={ui.settingsTabPanel} role="tabpanel">
                <div className={`${ui.settingsSection} ${ui.cliInstallSection}`}>
                  <div className={ui.settingsSectionHeading}>
                    <div className={ui.settingsLabel}>{t.cliSectionLabel}</div>
                    <div className={ui.settingsDescription}>
                      {t.cliSectionDescription}
                    </div>
                  </div>

                  <div className={ui.cliStatusRow}>
                    <div className={ui.cliStatusCopy}>
                      <span
                        className={`${ui.cliStatusBadge} ${
                          cliStatus?.isInstalled ? ui.cliStatusBadgeInstalled : ""
                        }`}
                      >
                        {cliStatus
                          ? cliStatus.isInstalled
                            ? t.cliInstalled
                            : t.cliNotInstalled
                          : t.cliChecking}
                      </span>
                      <div className={ui.settingsNote}>
                        {cliStatus
                          ? t.cliInstallPath(cliStatus.installPath)
                          : t.cliCheckingDescription}
                      </div>
                      {cliStatus && !cliStatus.isOnPath ? (
                        <div className={ui.settingsNote}>
                          {t.cliPathNotOnPath(cliStatus.installDir)}
                        </div>
                      ) : null}
                      {cliStatus && !cliStatus.sourceAvailable ? (
                        <div className={ui.settingsNote}>
                          {t.cliSourceUnavailable}
                        </div>
                      ) : null}
                    </div>

                    <button
                      className={ui.cliActionButton}
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

                  <div className={ui.cliCommandRow}>
                    <code className={ui.cliCommand}>
                      {cliStatus?.installCommand ?? t.cliChecking}
                    </code>
                    <button
                      className={ui.cliCopyButton}
                      disabled={!cliStatus}
                      onClick={copyCliInstallCommand}
                      type="button"
                    >
                      {t.cliCopyCommand}
                    </button>
                  </div>

                  {cliStatusError ? (
                    <div className={ui.settingsError}>{cliStatusError}</div>
                  ) : cliInstallMessage ? (
                    <div className={ui.settingsStatus} aria-live="polite">
                      {cliInstallMessage}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {settingsError ? (
              <div className={ui.settingsError}>{settingsError}</div>
            ) : null}
          </div>
        </div>
      </div>
    </DialogWindowFrame>
  );
}
