// 独立关于窗口：从隐藏 Tauri 窗口中渲染，不再遮挡主窗口内容。

import { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import appIconUrl from "../../src-tauri/icons/128x128.png";

import {
  APP_GITHUB_URL,
  APP_NAME,
  DEFAULT_APP_VERSION,
  DEFAULT_SETTINGS,
} from "../constants";
import { getTranslations } from "../i18n";
import {
  getAppVersion,
  getSettings,
  hideCurrentWindow,
  listenToSettingsUpdated,
} from "../lib/tauri";
import type { AppSettings } from "../types";
import { normalizeSettings } from "../utils/settings";

export function AboutWindow() {
  const [appVersion, setAppVersion] = useState(DEFAULT_APP_VERSION);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  // 根据当前语言取文案；settings 更新后组件会重新渲染，t 也会跟着切换语言。
  const t = getTranslations(settings.language).about;

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

  return (
    <div className="app-dialog-frame app-about-window">
      <div className="app-dialog-panel">
        <img className="app-about-icon" src={appIconUrl} alt="" aria-hidden="true" />

        <div className="app-modal-header">
          <span className="app-modal-title">{t.title}</span>
        </div>

        <div className="app-modal-content">
          <div className="app-modal-identity">
            <h2 className="app-modal-app-name">{APP_NAME}</h2>
            <span className="app-modal-version">{t.version(appVersion)}</span>
          </div>
          <p className="app-modal-description">{t.description}</p>
          <div className="app-modal-github" aria-label={t.githubLabel}>
            <span className="app-modal-github-label">{t.githubLabel}</span>
            <span className="app-modal-github-url">{APP_GITHUB_URL}</span>
          </div>
        </div>

        <div className="app-modal-footer">
          <button
            className="app-modal-btn"
            onClick={() => {
              void hideCurrentWindow();
            }}
            type="button"
          >
            {t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
