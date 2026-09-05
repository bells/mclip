// 独立偏好设置窗口：配置变更后立即写入，后端广播 settings-updated，主窗口同步刷新。

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

import appIconUrl from "../../app-icon.png";
import lightMenuBarIconUrl from "../../src-tauri/icons/menu-bar-icon-light-128.png";
import mMenuBarIconUrl from "../../src-tauri/icons/menu-bar-icon-m-128.png";
import {
  clampHistoryGroupItemCount,
  clampHistoryCount,
  clampMainWindowItemCount,
  DEFAULT_SETTINGS,
  MAX_MAX_HISTORY_COUNT,
  MAX_HISTORY_GROUP_ITEM_COUNT,
  MIN_MAX_HISTORY_COUNT,
  MIN_VISIBLE_ITEM_COUNT,
} from "../constants";
import { useApplyAppTheme } from "../hooks/useApplyAppTheme";
import { getTranslations } from "../i18n";
import {
  getCliInstallStatus,
  getAutoPastePermissionStatus,
  getDesktopCapabilities,
  getSourceAppDetectionStatus,
  getSettings,
  hideCurrentWindow,
  installCli,
  listenToSettingsUpdated,
  openAutoPastePermissionSettings,
  reclassifySensitiveHistory,
  saveSettings,
} from "../lib/tauri";
import type {
  AppLanguage,
  AppSettings,
  AppearanceTheme,
  AutoPastePermissionStatus,
  CliInstallStatus,
  DesktopCapabilities,
  DesktopCapability,
  HistoryKind,
  MenuBarIconStyle,
  SourceAppDetectionStatus,
} from "../types";
import {
  historyTypeRow,
  ui,
} from "../uiStyles";
import {
  getCliInstallErrorCode,
  getCliPrimaryAction,
} from "../utils/cliInstall";
import { normalizeSettings } from "../utils/settings";
import { reportAuxiliaryListenerReady } from "../services/auxiliaryWindows";
import { IgnoredApplicationsList } from "./preferences/IgnoredApplicationsList";
import { DialogStatusBar } from "./DialogStatusBar";
import { DialogWindowFrame } from "./DialogWindowFrame";
import { CheckIcon, ChevronRightIcon } from "./UiIcons";
import {
  PreferencePage,
  PreferenceRow,
  PreferenceSwitch,
} from "./preferences/PreferenceControls";
import {
  createPreferenceSaveController,
  type PreferenceFeedbackMap,
  type PreferenceFeedbackState,
  type PreferenceSaveController,
} from "./preferences/preferenceSaveController";
import { PreferencesSettingsCenter } from "./preferences/PreferencesSettingsCenter";
import { PreferencesPages } from "./preferences/PreferencesPages";
import {
  createPreferencesDestinations,
  preferenceFocusTargetId,
  type PreferencesDestinationId,
} from "./preferences/preferencesNavigation";

type VisibleItemCountSetting = "mainWindowItemCount" | "historyGroupItemCount";

type SettingsSelectFieldProps = {
  children: ReactNode;
  controlId: string;
  description: string;
  label: string;
  feedback?: PreferenceFeedbackState;
  feedbackLabels?: { error: string; pending: string; saved: string };
  settingId?: string;
};

function SettingsSelectField({
  children,
  controlId,
  description,
  feedback = "idle",
  feedbackLabels,
  label,
  settingId,
}: SettingsSelectFieldProps) {
  return (
    <div
      className={ui.preferenceRow}
      id={settingId ? preferenceFocusTargetId(settingId) : undefined}
    >
      <div className={ui.preferenceRowCopy}>
        <label className={ui.preferenceRowLabel} htmlFor={controlId}>
          {label}
        </label>
        <div className={ui.preferenceRowDescription}>{description}</div>
        {feedback !== "idle" && feedbackLabels ? (
          <div
            aria-live="polite"
            className={
              feedback === "error"
                ? ui.preferenceFeedbackError
                : ui.preferenceFeedback
            }
          >
            {feedback === "pending"
              ? feedbackLabels.pending
              : feedback === "saved"
                ? feedbackLabels.saved
                : feedbackLabels.error}
          </div>
        ) : null}
      </div>
      <div className={ui.preferenceRowControl}>{children}</div>
    </div>
  );
}

type SettingsGroupProps = {
  children: ReactNode;
  label: string;
  settingId?: string;
};

function SettingsGroup({ children, label, settingId }: SettingsGroupProps) {
  return (
    <section
      className={ui.preferenceGroup}
      id={settingId ? preferenceFocusTargetId(settingId) : undefined}
    >
      <h2 className={ui.preferenceGroupTitle}>{label}</h2>
      <div className={ui.preferenceGroupBody}>{children}</div>
    </section>
  );
}

type DesktopCapabilityRowProps = {
  capability: DesktopCapability;
  description: string;
  label: string;
  note?: string;
  statusLabels: Record<DesktopCapability["status"], string>;
};

function DesktopCapabilityRow({
  capability,
  description,
  label,
  note,
  statusLabels,
}: DesktopCapabilityRowProps) {
  const statusClassName =
    capability.status === "unavailable"
      ? "text-[10px] font-semibold text-[var(--mclip-danger)]"
      : capability.status === "degraded"
        ? "text-[10px] font-semibold text-[var(--mclip-meta)]"
        : "text-[10px] font-semibold text-[var(--mclip-accent-cool)]";

  return (
    <PreferenceRow description={description} label={label} note={note}>
      <span className={statusClassName}>{statusLabels[capability.status]}</span>
    </PreferenceRow>
  );
}

type MenuBarIconOption = {
  iconUrl: string;
  label: string;
  style: MenuBarIconStyle;
  surfaceClassName: string;
};

type MenuBarIconSelectProps = {
  controlId: string;
  label: string;
  onChange: (style: MenuBarIconStyle) => void;
  options: MenuBarIconOption[];
  value: MenuBarIconStyle;
};

function MenuBarIconSelect({
  controlId,
  label,
  onChange,
  options,
  value,
}: MenuBarIconSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = `${controlId}-options`;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.style === value),
  );
  const selectedOption = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      optionRefs.current[selectedIndex]?.focus();
    }
  }, [isOpen, selectedIndex]);

  const closeAndFocusTrigger = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const focusOption = (index: number) => {
    const optionCount = options.length;
    const nextIndex = (index + optionCount) % optionCount;
    optionRefs.current[nextIndex]?.focus();
  };

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusOption(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusOption(0);
        break;
      case "End":
        event.preventDefault();
        focusOption(options.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        closeAndFocusTrigger();
        break;
    }
  };

  if (!selectedOption) {
    return null;
  }

  return (
    <div className={ui.menuBarIconSelect} ref={rootRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={ui.menuBarIconSelectTrigger}
        id={controlId}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        ref={triggerRef}
        title={selectedOption.label}
        type="button"
      >
        <span
          className={`${ui.menuBarIconImageSurface} ${selectedOption.surfaceClassName}`}
        >
          <img
            alt={selectedOption.label}
            className={ui.menuBarIconImage}
            src={selectedOption.iconUrl}
          />
        </span>
        <ChevronRightIcon className={ui.menuBarIconSelectChevron} />
      </button>

      {isOpen ? (
        <div
          aria-label={label}
          className={ui.menuBarIconSelectOptions}
          id={listboxId}
          role="listbox"
        >
          {options.map((option, index) => (
            <button
              aria-label={option.label}
              aria-selected={option.style === value}
              className={`${ui.menuBarIconOption} ${
                option.style === value ? ui.menuBarIconOptionActive : ""
              }`}
              key={option.style}
              onClick={() => {
                onChange(option.style);
                closeAndFocusTrigger();
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              role="option"
              title={option.label}
              type="button"
            >
              <span
                className={`${ui.menuBarIconImageSurface} ${option.surfaceClassName}`}
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className={ui.menuBarIconImage}
                  src={option.iconUrl}
                />
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type SettingsSwitchItemProps = {
  checked: boolean;
  children?: ReactNode;
  description: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  feedback?: PreferenceFeedbackState;
  feedbackLabels?: { error: string; pending: string; saved: string };
  settingId?: string;
};

function SettingsSwitchItem({
  checked,
  children,
  description,
  disabled = false,
  feedback = "idle",
  feedbackLabels,
  label,
  onClick,
  settingId,
}: SettingsSwitchItemProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div
      className={`${ui.preferenceRow} ${disabled ? "opacity-65" : ""}`}
      id={settingId ? preferenceFocusTargetId(settingId) : undefined}
    >
      <div className={ui.preferenceRowCopy}>
        <div className={ui.preferenceRowLabel} id={labelId}>
          {label}
        </div>
        <div className={ui.preferenceRowDescription} id={descriptionId}>
          {description}
        </div>
        {feedback !== "idle" && feedbackLabels ? (
          <div
            aria-live="polite"
            className={
              feedback === "error"
                ? ui.preferenceFeedbackError
                : ui.preferenceFeedback
            }
          >
            {feedback === "pending"
              ? feedbackLabels.pending
              : feedback === "saved"
                ? feedbackLabels.saved
                : feedbackLabels.error}
          </div>
        ) : null}
        {children ? <div className={ui.preferenceRowNote}>{children}</div> : null}
      </div>
      <div className={ui.preferenceRowControl}>
        <button
          aria-checked={checked}
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          className={ui.preferenceSwitch(checked)}
          disabled={disabled}
          onClick={onClick}
          role="switch"
          type="button"
        >
          <span className={ui.preferenceSwitchThumb} />
        </button>
      </div>
    </div>
  );
}

export function PreferencesWindow() {
  // settingsDraft 保留了旧命名，但现在每次控件变更都会立即写入后端。
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeDestinationId, setActiveDestinationId] =
    useState<PreferencesDestinationId>("general");
  const [settingsError, setSettingsError] = useState("");
  const [preferenceFeedback, setPreferenceFeedback] =
    useState<PreferenceFeedbackMap>({});
  const [autoPastePermissionStatus, setAutoPastePermissionStatus] =
    useState<AutoPastePermissionStatus | null>(null);
  const [sourceAppDetectionStatus, setSourceAppDetectionStatus] =
    useState<SourceAppDetectionStatus | null>(null);
  const [desktopCapabilities, setDesktopCapabilities] =
    useState<DesktopCapabilities | null>(null);
  const [privacyMessage, setPrivacyMessage] = useState("");
  const [privacyError, setPrivacyError] = useState("");
  const [isReclassifyingHistory, setIsReclassifyingHistory] = useState(false);
  const [isCheckingAutoPastePermission, setIsCheckingAutoPastePermission] =
    useState(false);
  const [cliStatus, setCliStatus] = useState<CliInstallStatus | null>(null);
  const [cliStatusError, setCliStatusError] = useState("");
  const [cliInstallMessage, setCliInstallMessage] = useState("");
  const [isInstallingCli, setIsInstallingCli] = useState(false);
  const latestSettingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const preferenceSaveControllerRef =
    useRef<PreferenceSaveController<AppSettings> | null>(null);
  const isMacOs = navigator.platform.toLowerCase().includes("mac");
  const languageSelectId = useId();
  const appearanceThemeSelectId = useId();
  const menuBarIconStyleSelectId = useId();
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
  const feedbackLabels = { error: t.error, pending: t.saving, saved: t.saved };
  const desktopCapabilityStatusLabels = {
    available: t.desktopCapabilityAvailable,
    degraded: t.desktopCapabilityDegraded,
    unavailable: t.desktopCapabilityUnavailable,
  } as const;
  const destinations = createPreferencesDestinations(
    (key) => t[key] as string,
  );
  const menuBarIconOptions: MenuBarIconOption[] = [
    {
      iconUrl: appIconUrl,
      label: t.menuBarIconStyleAppIcon,
      style: "appIcon",
      surfaceClassName: ui.menuBarIconOptionAppSurface,
    },
    {
      iconUrl: lightMenuBarIconUrl,
      label: t.menuBarIconStyleLight,
      style: "light",
      surfaceClassName: ui.menuBarIconOptionLightSurface,
    },
    {
      iconUrl: mMenuBarIconUrl,
      label: t.menuBarIconStyleM,
      style: "m",
      surfaceClassName: ui.menuBarIconOptionMSurface,
    },
  ];
  const mainWindowItemCountMax = settingsDraft.maxHistoryCount;
  const cliPrimaryAction = cliStatus
    ? getCliPrimaryAction(cliStatus.state, cliStatus.platformSupported)
    : "none";
  const cliStateLabel = (() => {
    switch (cliStatus?.state) {
      case "current":
        return t.cliCurrent;
      case "outdated":
        return t.cliOutdated;
      case "newer":
        return t.cliNewer;
      case "unknown":
        return t.cliLegacyVersion;
      case "notInstalled":
        return t.cliNotInstalled;
      default:
        return t.cliChecking;
    }
  })();
  const cliActionLabel = (() => {
    switch (cliPrimaryAction) {
      case "install":
        return t.cliInstall;
      case "upgrade":
        return t.cliUpgrade;
      case "reinstall":
        return t.cliReinstall;
      case "none":
        return t.cliInstallUnavailable;
    }
  })();

  const syncSettingsState = (nextSettings: AppSettings) => {
    latestSettingsRef.current = nextSettings;
    setSettingsDraft(nextSettings);
    setMaxHistoryCountInput(String(nextSettings.maxHistoryCount));
    setVisibleItemCountInputs({
      historyGroupItemCount: String(nextSettings.historyGroupItemCount),
      mainWindowItemCount: String(nextSettings.mainWindowItemCount),
    });
  };

  if (!preferenceSaveControllerRef.current) {
    preferenceSaveControllerRef.current = createPreferenceSaveController({
      initialSettings: DEFAULT_SETTINGS,
      normalize: normalizeSettings,
      onFeedback: setPreferenceFeedback,
      onSettings: syncSettingsState,
      save: saveSettings,
    });
  }

  useEffect(() => {
    let isActive = true;
    void getDesktopCapabilities()
      .then((capabilities) => {
        if (isActive) {
          setDesktopCapabilities(capabilities);
        }
      })
      .catch(() => {
        if (isActive) {
          setDesktopCapabilities(null);
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    void getSourceAppDetectionStatus()
      .then((status) => {
        if (isActive) {
          setSourceAppDetectionStatus(status);
        }
      })
      .catch(() => {
        if (isActive) {
          setSourceAppDetectionStatus({
            capability: "unavailable",
            reasonCode: "sourceIdentityStatusUnavailable",
          });
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

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

        preferenceSaveControllerRef.current?.syncExternal(loadedSettings);
        setSettingsError("");
      } catch (error) {
        console.error("加载偏好设置失败:", error);
      }
    };

    void loadSettings();
    void listenToSettingsUpdated((updatedSettings) => {
      const normalizedSettings = normalizeSettings(updatedSettings);
      preferenceSaveControllerRef.current?.syncExternal(normalizedSettings);
      setSettingsError("");
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
      reportAuxiliaryListenerReady("settingsUpdated");
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

  const applySettingsPatch = (
    updater: (currentSettings: AppSettings) => AppSettings,
    settingId = "settings",
  ) => {
    setSettingsError("");
    void preferenceSaveControllerRef.current?.apply(settingId, updater);
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
    }), "general.launch-at-login");
  };

  const toggleAutoPaste = async () => {
    const currentSettings = latestSettingsRef.current;

    if (currentSettings.autoPaste) {
      applySettingsPatch((current) => ({
        ...current,
        autoPaste: false,
      }), "general.auto-paste");
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
    }), "general.auto-paste");
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
    }), "general.language");
  };

  const updateMenuBarIconStyle = (menuBarIconStyle: MenuBarIconStyle) => {
    applySettingsPatch((current) => ({
      ...current,
      menuBarIconStyle,
    }), "appearance.menu-bar-icon");
  };

  const updateAppearanceTheme = (appearanceTheme: AppearanceTheme) => {
    applySettingsPatch((current) => ({
      ...current,
      appearanceTheme,
    }), "appearance.theme");
  };

  const toggleHistoryItemNumbers = () => {
    applySettingsPatch((current) => ({
      ...current,
      showHistoryItemNumbers: !current.showHistoryItemNumbers,
    }), "appearance.item-numbers");
  };

  const toggleMainWindowBrand = () => {
    applySettingsPatch((current) => ({
      ...current,
      showMainWindowBrand: !current.showMainWindowBrand,
    }), "appearance.brand");
  };

  const toggleSensitiveContentMasking = () => {
    applySettingsPatch((current) => ({
      ...current,
      maskSensitiveContent: !current.maskSensitiveContent,
    }), "privacy.masking");
  };

  const reclassifyLegacyHistory = async () => {
    setIsReclassifyingHistory(true);
    setPrivacyError("");
    setPrivacyMessage("");
    try {
      await reclassifySensitiveHistory();
      setPrivacyMessage(t.reclassifyLegacySuccess);
    } catch {
      setPrivacyError(t.reclassifyLegacyError);
    } finally {
      setIsReclassifyingHistory(false);
    }
  };

  const toggleHistoryType = (kind: HistoryKind) => {
    applySettingsPatch((current) => ({
      ...current,
      enabledHistoryTypes: {
        ...current.enabledHistoryTypes,
        // 计算属性名：用变量 kind 的值作为对象 key，比如 "text" / "image" / "files"。
        [kind]: !current.enabledHistoryTypes[kind],
      },
    }), "history.types");
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
    }), "history.maximum");
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
          }), "history.maximum");
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
      : MAX_HISTORY_GROUP_ITEM_COUNT;

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
    }), settingKey === "mainWindowItemCount" ? "history.main-count" : "history.group-count");
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
        }), settingKey === "mainWindowItemCount" ? "history.main-count" : "history.group-count");
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
      setCliInstallMessage(
        t.cliInstallSuccess(status.installPath, status.targetVersion),
      );
    } catch (error) {
      console.error("安装 mclip-cli 失败:", error);
      const errorCode = getCliInstallErrorCode(error);

      switch (errorCode) {
        case "CLI_UNSUPPORTED_PLATFORM":
          setCliStatusError(t.cliPlatformUnsupported);
          break;
        case "CLI_RELEASE_UNAVAILABLE":
          setCliStatusError(t.cliReleaseUnavailableError);
          break;
        case "CLI_CHECKSUM_UNAVAILABLE":
        case "CLI_CHECKSUM_INVALID":
        case "CLI_CHECKSUM_MISMATCH":
          setCliStatusError(t.cliIntegrityError);
          break;
        case "CLI_REPLACE_FAILED":
        case "CLI_DESTINATION_UNSAFE":
          setCliStatusError(t.cliReplaceError);
          break;
        case "CLI_INSTALL_BUSY":
          setCliStatusError(t.cliInstallBusyError);
          break;
        case "CLI_POST_INSTALL_VERIFY_FAILED":
          setCliStatusError(t.cliPostInstallVerifyError);
          break;
        case "CLI_DOWNLOAD_TOO_LARGE":
        case "CLI_DOWNLOAD_FAILED":
          setCliStatusError(t.cliDownloadError);
          break;
        case "UNKNOWN":
          setCliStatusError(t.cliInstallError);
          break;
      }
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
          centerTitle
          controlsLabels={translations.windowControls}
          title={t.title}
        />

        <PreferencesSettingsCenter
          activeDestinationId={activeDestinationId}
          destinations={destinations}
          onDestinationChange={setActiveDestinationId}
          translations={t}
        >
          <PreferencesPages
            activeDestinationId={activeDestinationId}
            pages={{
              general: (
              <PreferencePage
                description={t.generalPageDescription}
                title={t.generalTab}
              >
                <SettingsGroup label={t.interfaceGroupLabel}>
                  <SettingsSelectField
                    controlId={languageSelectId}
                    description={t.languageDescription}
                    feedback={preferenceFeedback["general.language"]}
                    feedbackLabels={feedbackLabels}
                    label={t.languageLabel}
                    settingId="general.language"
                  >
                    <select
                      aria-label={t.languageLabel}
                      className={ui.settingsSelect}
                      id={languageSelectId}
                      onChange={(event) => updateLanguage(event.target.value as AppLanguage)}
                      value={settingsDraft.language}
                    >
                      <option value="system">{t.languageSystem}</option>
                      <option value="zhCn">{t.languageChinese}</option>
                      <option value="en">{t.languageEnglish}</option>
                      <option value="ja">{t.languageJapanese}</option>
                    </select>
                  </SettingsSelectField>

                </SettingsGroup>

                <SettingsGroup label={t.behaviorGroupLabel}>
                  <SettingsSwitchItem
                    checked={settingsDraft.launchAtLogin}
                    description={t.launchAtLoginDescription}
                    feedback={preferenceFeedback["general.launch-at-login"]}
                    feedbackLabels={feedbackLabels}
                    label={t.launchAtLoginLabel}
                    onClick={toggleLaunchAtLogin}
                    settingId="general.launch-at-login"
                  />

                  <SettingsSwitchItem
                    checked={settingsDraft.autoPaste}
                    description={t.autoPasteDescription}
                    disabled={
                      isCheckingAutoPastePermission ||
                      desktopCapabilities?.autoPaste.status === "unavailable"
                    }
                    feedback={preferenceFeedback["general.auto-paste"]}
                    feedbackLabels={feedbackLabels}
                    label={t.autoPasteLabel}
                    onClick={() => void toggleAutoPaste()}
                    settingId="general.auto-paste"
                  >
                    {isMacOs ? (
                      <span className={ui.settingsNote}>
                        {t.autoPastePermissionNote}
                      </span>
                    ) : null}
                    {isMacOs && autoPastePermissionStatus ? (
                      <span
                        className={`${ui.settingsNote} ${
                          autoPastePermissionStatus.isGranted
                            ? ui.settingsNoteOk
                            : ui.settingsNoteWarning
                        }`}
                      >
                        {autoPastePermissionStatus.isGranted
                          ? t.autoPastePermissionGranted
                          : t.autoPastePermissionStatus(autoPastePermissionStatus.appPath)}
                      </span>
                    ) : null}
                  </SettingsSwitchItem>

                  {isMacOs ? (
                    <div className={ui.settingsSwitchActions}>
                      <button
                        className={ui.settingsActionButton}
                        onClick={openAutoPastePermission}
                        type="button"
                      >
                        {t.autoPastePermissionAction}
                      </button>

                      <button
                        className={ui.settingsActionButton}
                        disabled={isCheckingAutoPastePermission}
                        onClick={() => void refreshAutoPastePermissionStatus()}
                        type="button"
                      >
                        {t.autoPastePermissionRefreshAction}
                      </button>
                    </div>
                  ) : null}
                </SettingsGroup>

                {desktopCapabilities?.platform === "linux" ? (
                  <SettingsGroup
                    label={t.desktopCapabilitiesGroupLabel}
                    settingId="general.desktop-capabilities"
                  >
                    <DesktopCapabilityRow
                      capability={desktopCapabilities.clipboardHistory}
                      description={t.desktopClipboardHistoryDescription}
                      label={t.desktopClipboardHistoryLabel}
                      note={
                        desktopCapabilities.clipboardHistory.status === "unavailable"
                          ? t.linuxWaylandClipboardUnavailable
                          : desktopCapabilities.clipboardHistory.status === "degraded"
                            ? t.linuxClipboardFallbackDegraded
                            : undefined
                      }
                      statusLabels={desktopCapabilityStatusLabels}
                    />
                    <DesktopCapabilityRow
                      capability={desktopCapabilities.clipboardWrite}
                      description={t.desktopClipboardWriteDescription}
                      label={t.desktopClipboardWriteLabel}
                      note={
                        desktopCapabilities.clipboardWrite.status === "unavailable"
                          ? t.linuxWaylandClipboardUnavailable
                          : desktopCapabilities.clipboardWrite.status === "degraded"
                            ? t.linuxClipboardFallbackDegraded
                            : undefined
                      }
                      statusLabels={desktopCapabilityStatusLabels}
                    />
                    <DesktopCapabilityRow
                      capability={desktopCapabilities.trayActivation}
                      description={t.desktopTrayDescription}
                      label={t.desktopTrayLabel}
                      note={
                        desktopCapabilities.trayActivation.status === "unavailable"
                          ? t.linuxTrayUnavailable
                          : undefined
                      }
                      statusLabels={desktopCapabilityStatusLabels}
                    />
                    <DesktopCapabilityRow
                      capability={desktopCapabilities.globalShortcut}
                      description={t.desktopShortcutDescription}
                      label={t.desktopShortcutLabel}
                      note={
                        desktopCapabilities.globalShortcut.status === "unavailable"
                          ? t.linuxShortcutUnavailable
                          : undefined
                      }
                      statusLabels={desktopCapabilityStatusLabels}
                    />
                    <DesktopCapabilityRow
                      capability={desktopCapabilities.sourceAppDetection}
                      description={t.desktopSourceAppDescription}
                      label={t.desktopSourceAppLabel}
                      note={
                        desktopCapabilities.sourceAppDetection.status === "unavailable"
                          ? t.linuxSourceIdentityUnavailable
                          : undefined
                      }
                      statusLabels={desktopCapabilityStatusLabels}
                    />
                    <DesktopCapabilityRow
                      capability={desktopCapabilities.launchAtLogin}
                      description={t.desktopAutostartDescription}
                      label={t.desktopAutostartLabel}
                      note={
                        desktopCapabilities.launchAtLogin.status === "unavailable"
                          ? t.linuxAutostartUnavailable
                          : undefined
                      }
                      statusLabels={desktopCapabilityStatusLabels}
                    />
                    <DesktopCapabilityRow
                      capability={desktopCapabilities.autoPaste}
                      description={t.desktopAutoPasteDescription}
                      label={t.desktopAutoPasteLabel}
                      note={
                        desktopCapabilities.autoPaste.status === "unavailable"
                          ? t.linuxAutoPasteUnavailable
                          : undefined
                      }
                      statusLabels={desktopCapabilityStatusLabels}
                    />
                  </SettingsGroup>
                ) : null}

              </PreferencePage>
              ),
              appearance: (

              <PreferencePage
                description={t.appearancePageDescription}
                title={t.appearanceTab}
              >
                <SettingsGroup label={t.interfaceGroupLabel}>
                  <SettingsSelectField
                    controlId={appearanceThemeSelectId}
                    description={t.appearanceThemeDescription}
                    feedback={preferenceFeedback["appearance.theme"]}
                    feedbackLabels={feedbackLabels}
                    label={t.appearanceThemeLabel}
                    settingId="appearance.theme"
                  >
                    <select
                      aria-label={t.appearanceThemeLabel}
                      className={ui.settingsSelect}
                      id={appearanceThemeSelectId}
                      onChange={(event) =>
                        updateAppearanceTheme(event.target.value as AppearanceTheme)
                      }
                      value={settingsDraft.appearanceTheme}
                    >
                      <option value="system">{t.appearanceThemeSystem}</option>
                      <option value="light">{t.appearanceThemeLight}</option>
                      <option value="dark">{t.appearanceThemeDark}</option>
                    </select>
                  </SettingsSelectField>

                  <SettingsSelectField
                    controlId={menuBarIconStyleSelectId}
                    description={t.menuBarIconStyleDescription}
                    feedback={preferenceFeedback["appearance.menu-bar-icon"]}
                    feedbackLabels={feedbackLabels}
                    label={t.menuBarIconStyleLabel}
                    settingId="appearance.menu-bar-icon"
                  >
                    <MenuBarIconSelect
                      controlId={menuBarIconStyleSelectId}
                      label={t.menuBarIconStyleLabel}
                      onChange={updateMenuBarIconStyle}
                      options={menuBarIconOptions}
                      value={settingsDraft.menuBarIconStyle}
                    />
                  </SettingsSelectField>
                </SettingsGroup>

                <SettingsGroup label={t.mainWindowGroupLabel}>
                  <SettingsSwitchItem
                    checked={settingsDraft.showMainWindowBrand}
                    description={t.showMainWindowBrandDescription}
                    feedback={preferenceFeedback["appearance.brand"]}
                    feedbackLabels={feedbackLabels}
                    label={t.showMainWindowBrandLabel}
                    onClick={toggleMainWindowBrand}
                    settingId="appearance.brand"
                  />
                  <SettingsSwitchItem
                    checked={settingsDraft.showHistoryItemNumbers}
                    description={t.showHistoryItemNumbersDescription}
                    feedback={preferenceFeedback["appearance.item-numbers"]}
                    feedbackLabels={feedbackLabels}
                    label={t.showHistoryItemNumbersLabel}
                    onClick={toggleHistoryItemNumbers}
                    settingId="appearance.item-numbers"
                  />
                </SettingsGroup>
              </PreferencePage>
              ),
              history: (

              <PreferencePage
                description={t.historyPageDescription}
                title={t.historyTab}
              >
                <div
                  className={`${ui.settingsSection} ${ui.historyTypesSection}`}
                  id={preferenceFocusTargetId("history.types")}
                >
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

                <div
                  className={ui.settingsRow}
                  id={preferenceFocusTargetId("history.maximum")}
                >
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
                      step={1}
                      type="number"
                      value={maxHistoryCountInput}
                    />
                  </div>
                </div>

                <div
                  className={ui.settingsRow}
                  id={preferenceFocusTargetId("history.main-count")}
                >
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
                      step={1}
                      type="number"
                      value={visibleItemCountInputs.mainWindowItemCount}
                    />
                  </div>
                </div>

                <div
                  className={ui.settingsRow}
                  id={preferenceFocusTargetId("history.group-count")}
                >
                  <div className={ui.settingsCopy}>
                    <div className={ui.settingsLabel}>
                      {t.historyGroupItemCountLabel}
                    </div>
                    <div className={ui.settingsDescription}>
                      {t.historyGroupItemCountDescription}
                    </div>
                    <div className={ui.settingsNote}>
                      {t.rangeNote(
                        MIN_VISIBLE_ITEM_COUNT,
                        MAX_HISTORY_GROUP_ITEM_COUNT,
                      )}
                    </div>
                  </div>

                  <div className={ui.stepper}>
                    <input
                      aria-label={t.historyGroupItemCountAriaLabel}
                      className={ui.stepperInput}
                      max={MAX_HISTORY_GROUP_ITEM_COUNT}
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
                      step={1}
                      type="number"
                      value={visibleItemCountInputs.historyGroupItemCount}
                    />
                  </div>
                </div>

              </PreferencePage>
              ),
              privacy: (

              <PreferencePage
                description={t.privacyPageDescription}
                title={t.privacyTab}
              >
                <SettingsGroup label={t.privacyProtectionGroupLabel}>
                  <SettingsSwitchItem
                    checked={settingsDraft.maskSensitiveContent}
                    description={t.maskSensitiveContentDescription}
                    feedback={preferenceFeedback["privacy.masking"]}
                    feedbackLabels={feedbackLabels}
                    label={t.maskSensitiveContentLabel}
                    onClick={toggleSensitiveContentMasking}
                    settingId="privacy.masking"
                  >
                    <span className={ui.settingsNote}>
                      {t.privacyStorageDisclosure}
                    </span>
                  </SettingsSwitchItem>

                  <div
                    className={ui.settingsSwitchActions}
                    id={preferenceFocusTargetId("privacy.reclassify")}
                  >
                    <div className={ui.settingsCopy}>
                      <div className={ui.settingsDescription}>
                        {t.reclassifyLegacyDescription}
                      </div>
                    </div>
                    <button
                      className={ui.settingsActionButton}
                      disabled={isReclassifyingHistory}
                      onClick={() => void reclassifyLegacyHistory()}
                      type="button"
                    >
                      {isReclassifyingHistory
                        ? t.reclassifyLegacyRunning
                        : t.reclassifyLegacyAction}
                    </button>
                  </div>
                </SettingsGroup>

                <SettingsGroup label={t.sourceExclusionGroupLabel}>
                  <div className={`${ui.settingsSectionHeading} px-4 pt-3`}>
                    <div className={ui.settingsDescription}>
                      {sourceAppDetectionStatus?.capability === "available"
                        ? t.sourceDetectionAvailable
                        : sourceAppDetectionStatus?.capability === "degraded"
                          ? t.sourceDetectionDegraded
                          : t.sourceDetectionUnavailable}
                    </div>
                  </div>

                  <div id={preferenceFocusTargetId("privacy.source-exclusion")}>
                    <IgnoredApplicationsList
                      canAdd={sourceAppDetectionStatus?.capability === "available" || sourceAppDetectionStatus?.capability === "degraded"}
                      feedback={preferenceFeedback["privacy.source-exclusion"]}
                      identifiers={settingsDraft.ignoredSourceAppIds}
                      onChange={(ignoredSourceAppIds) => applySettingsPatch((current) => ({
                        ...current,
                        ignoredSourceAppIds,
                      }), "privacy.source-exclusion")}
                      translations={t}
                    />
                  </div>

                  {privacyError ? (
                    <div className={ui.settingsError}>{privacyError}</div>
                  ) : privacyMessage ? (
                    <div className={ui.settingsStatus} aria-live="polite">
                      {privacyMessage}
                    </div>
                  ) : null}
                </SettingsGroup>
              </PreferencePage>
              ),
              textActions: (

              <PreferencePage
                description={t.textActionsPageDescription}
                title={t.textActionsTab}
              >
                <SettingsGroup label={t.textActionsGroupLabel}>
                  {([
                    ["json", t.textActionJsonLabel, t.textActionJsonDescription],
                    ["base64", t.textActionBase64Label, t.textActionBase64Description],
                    ["urlComponent", t.textActionUrlLabel, t.textActionUrlDescription],
                  ] as const).map(([group, label, description]) => (
                    <PreferenceRow
                      description={description}
                      feedback={
                        preferenceFeedback[
                          `text-actions.${group === "urlComponent" ? "url" : group}`
                        ]
                      }
                      feedbackLabels={{
                        error: t.error,
                        pending: t.saving,
                        saved: t.saved,
                      }}
                      focusTargetId={preferenceFocusTargetId(
                        `text-actions.${group === "urlComponent" ? "url" : group}`,
                      )}
                      key={group}
                      label={label}
                    >
                      <PreferenceSwitch
                        checked={settingsDraft.textQuickActions[group]}
                        label={label}
                        onChange={() =>
                          applySettingsPatch((current) => ({
                            ...current,
                            textQuickActions: {
                              ...current.textQuickActions,
                              [group]: !current.textQuickActions[group],
                            },
                          }), `text-actions.${group === "urlComponent" ? "url" : group}`)
                        }
                      />
                    </PreferenceRow>
                  ))}
                  <div className={ui.settingsSwitchActions}>
                    <span className={ui.settingsNote}>{t.textActionsBoundaryNote}</span>
                  </div>
                </SettingsGroup>
              </PreferencePage>
              ),
              cli: (

              <PreferencePage
                description={t.cliPageDescription}
                title={t.cliTab}
              >
                <div
                  className={`${ui.settingsSection} ${ui.cliInstallSection}`}
                  id={preferenceFocusTargetId("cli.status")}
                >
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
                          cliStatus?.state === "current" ||
                          cliStatus?.state === "newer"
                            ? ui.cliStatusBadgeInstalled
                            : ""
                        }`}
                      >
                        {cliStateLabel}
                      </span>
                      <div className={ui.settingsNote}>
                        {cliStatus
                          ? t.cliInstallPath(cliStatus.installPath)
                          : t.cliCheckingDescription}
                      </div>
                      {cliStatus ? (
                        <div className={ui.settingsNote}>
                          {t.cliVersionSummary(
                            cliStatus.installedVersion ?? t.cliUnknownVersion,
                            cliStatus.targetVersion,
                          )}
                        </div>
                      ) : null}
                      {cliStatus?.state === "unknown" ? (
                        <div className={ui.settingsNote}>{t.cliLegacyVersion}</div>
                      ) : null}
                      {cliStatus && !cliStatus.isOnPath ? (
                        <div className={ui.settingsNote}>
                          {t.cliPathNotOnPath(cliStatus.installDir)}
                        </div>
                      ) : null}
                      {cliStatus && !cliStatus.platformSupported ? (
                        <div className={ui.settingsNote}>
                          {t.cliPlatformUnsupported}
                        </div>
                      ) : null}
                    </div>

                    <button
                      className={ui.cliActionButton}
                      disabled={
                        isInstallingCli ||
                        !cliStatus ||
                        cliPrimaryAction === "none"
                      }
                      onClick={handleInstallCli}
                      type="button"
                    >
                      {isInstallingCli
                        ? t.cliInstalling
                        : cliActionLabel}
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
              </PreferencePage>
              ),
            }}
          />

            {settingsError ? (
              <div className={ui.settingsError}>{settingsError}</div>
            ) : null}
        </PreferencesSettingsCenter>
      </div>
    </DialogWindowFrame>
  );
}
