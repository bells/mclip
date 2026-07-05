// 独立关于窗口：从隐藏 Tauri 窗口中渲染，不再遮挡主窗口内容。

import { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import appIconUrl from "../../src-tauri/icons/128x128.png";

import {
  APP_NAME,
  DEFAULT_APP_VERSION,
  DEFAULT_SETTINGS,
  GITHUB_LATEST_RELEASE_API_URL,
} from "../constants";
import { useApplyAppTheme } from "../hooks/useApplyAppTheme";
import { DialogStatusBar } from "./DialogStatusBar";
import { DialogWindowFrame } from "./DialogWindowFrame";
import { getTranslations } from "../i18n";
import {
  getAppVersion,
  getSettings,
  hideCurrentWindow,
  listenToSettingsUpdated,
  copyDiagnosticReport,
  openIssueReport,
  openLogsDir,
  openProjectLink,
  type ProjectLinkTarget,
} from "../lib/tauri";
import type { AppSettings } from "../types";
import { ui } from "../uiStyles";
import { normalizeSettings } from "../utils/settings";
import {
  isReleaseNewer,
  parseGitHubLatestReleaseResponse,
} from "../utils/updateCheck";

type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; latestVersion: string }
  | { kind: "upToDate"; latestVersion: string }
  | { kind: "notFound" }
  | { kind: "error"; reason: "check" | "openRelease" };

export function AboutWindow() {
  const [appVersion, setAppVersion] = useState(DEFAULT_APP_VERSION);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [diagnosticMessage, setDiagnosticMessage] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: "idle" });
  // 根据当前语言取文案；settings 更新后组件会重新渲染，t 也会跟着切换语言。
  const translations = getTranslations(settings.language);
  useApplyAppTheme(settings.appearanceTheme);
  const t = translations.about;
  const isCheckingUpdates = updateStatus.kind === "checking";
  const isUpdateAvailable = updateStatus.kind === "available";
  const updateActionsClassName = isUpdateAvailable
    ? ui.aboutUpdateActionsSplit
    : ui.aboutUpdateActions;

  useEffect(() => {
    let isActive = true;
    let unlisten: UnlistenFn | undefined;

    const loadAboutData = async () => {
      try {
        // Promise.all 并行读取设置和版本号，比顺序 await 少一次等待。
        const [loadedSettings, version] = await Promise.all([
          getSettings(),
          getAppVersion(),
        ]);

        if (!isActive) {
          return;
        }

        setSettings(normalizeSettings(loadedSettings));
        setAppVersion(version);
      } catch (error) {
        console.error("加载关于窗口失败:", error);
      }
    };

    void loadAboutData();
    void listenToSettingsUpdated((updatedSettings) => {
      setSettings(normalizeSettings(updatedSettings));
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

  const handleOpenLogs = async () => {
    try {
      setDiagnosticMessage("");
      await openLogsDir();
    } catch (error) {
      console.error("打开日志目录失败:", error);
      setDiagnosticMessage(t.openLogsError);
    }
  };

  const handleCopyDiagnostics = async () => {
    try {
      await copyDiagnosticReport();
      setDiagnosticMessage(t.copyDiagnosticsSuccess);
    } catch (error) {
      console.error("复制诊断信息失败:", error);
      setDiagnosticMessage(t.copyDiagnosticsError);
    }
  };

  const handleReportIssue = async () => {
    try {
      setDiagnosticMessage("");
      await openIssueReport();
    } catch (error) {
      console.error("打开问题反馈页面失败:", error);
      setDiagnosticMessage(t.reportIssueError);
    }
  };

  const handleOpenProjectLink = async (target: ProjectLinkTarget) => {
    try {
      setDiagnosticMessage("");
      await openProjectLink(target);
    } catch (error) {
      console.error("打开项目链接失败:", error);
      setDiagnosticMessage(t.openLinkError);
    }
  };

  const handleCheckUpdates = async () => {
    if (isCheckingUpdates) {
      return;
    }

    try {
      setDiagnosticMessage("");
      setUpdateStatus({ kind: "checking" });

      const response = await fetch(GITHUB_LATEST_RELEASE_API_URL, {
        headers: {
          Accept: "application/vnd.github+json",
        },
      });

      if (response.status === 404) {
        setUpdateStatus({ kind: "notFound" });
        return;
      }

      if (!response.ok) {
        throw new Error(`GitHub release check failed: ${response.status}`);
      }

      const release = parseGitHubLatestReleaseResponse(await response.json());

      if (!release) {
        setUpdateStatus({ kind: "notFound" });
        return;
      }

      setUpdateStatus(
        isReleaseNewer(release.version, appVersion)
          ? { kind: "available", latestVersion: release.version }
          : { kind: "upToDate", latestVersion: release.version },
      );
    } catch (error) {
      console.error("检查更新失败:", error);
      setUpdateStatus({ kind: "error", reason: "check" });
    }
  };

  const handleOpenLatestRelease = async () => {
    try {
      await openProjectLink("latestRelease");
    } catch (error) {
      console.error("打开最新版本下载页失败:", error);
      setUpdateStatus({ kind: "error", reason: "openRelease" });
    }
  };

  const getUpdateStatusMessage = () => {
    switch (updateStatus.kind) {
      case "checking":
        return t.updateChecking;
      case "available":
        return t.updateAvailable(updateStatus.latestVersion);
      case "upToDate":
        return t.updateUpToDate(updateStatus.latestVersion);
      case "notFound":
        return t.updateNotFound;
      case "error":
        return updateStatus.reason === "openRelease"
          ? t.updateOpenReleaseError
          : t.updateCheckError;
      default:
        return "";
    }
  };

  return (
    <DialogWindowFrame className={ui.aboutWindowFrame}>
      <div className={ui.dialogPanel}>
        <DialogStatusBar
          centerTitle
          controlsLabels={translations.windowControls}
          title={t.title}
        />

        <div className={ui.aboutContent}>
          <section className={ui.aboutHero} aria-labelledby="about-app-name">
            <div className={ui.aboutHeroIdentity}>
              <img
                className={ui.aboutHeroIcon}
                src={appIconUrl}
                alt=""
                aria-hidden="true"
              />
              <h2 className={ui.aboutHeroName} id="about-app-name">
                {APP_NAME}
              </h2>
              <span className={ui.aboutHeroVersion}>{t.version(appVersion)}</span>
            </div>
            <p className={ui.aboutDescription}>{t.description}</p>
          </section>

          <div className={ui.aboutPrimaryActions} aria-label={t.linksLabel}>
            {([
              ["github", t.githubLabel],
              ["homepage", t.homepageLabel],
            ] as const).map(([target, label]) => (
              <button
                className={ui.aboutAccentButton}
                key={target}
                onClick={() => {
                  void handleOpenProjectLink(target);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className={updateActionsClassName}>
            <button
              className={ui.aboutButton}
              disabled={isCheckingUpdates}
              onClick={() => {
                void handleCheckUpdates();
              }}
              type="button"
            >
              {isCheckingUpdates ? t.updateChecking : t.updateCheck}
            </button>
            {isUpdateAvailable ? (
              <button
                className={ui.aboutAccentButton}
                onClick={() => {
                  void handleOpenLatestRelease();
                }}
                type="button"
              >
                {t.updateOpenRelease}
              </button>
            ) : null}
          </div>
          <p
            className={`${ui.aboutStatus} ${
              updateStatus.kind === "error" ? ui.updateStatusError : ""
            }`}
            aria-live="polite"
          >
            {getUpdateStatusMessage()}
          </p>
          <div className={ui.aboutDiagnosticsActions}>
            <button
              className={ui.aboutDiagnosticsButton}
              onClick={handleOpenLogs}
              type="button"
            >
              {t.openLogs}
            </button>
            <button
              className={ui.aboutDiagnosticsButton}
              onClick={handleCopyDiagnostics}
              type="button"
            >
              {t.copyDiagnostics}
            </button>
            <button
              className={ui.aboutDiagnosticsButton}
              onClick={handleReportIssue}
              type="button"
            >
              {t.reportIssue}
            </button>
          </div>
          <p className={ui.aboutStatus} aria-live="polite">
            {diagnosticMessage}
          </p>
        </div>
      </div>
    </DialogWindowFrame>
  );
}
