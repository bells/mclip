// 独立关于窗口：从隐藏 Tauri 窗口中渲染，不再遮挡主窗口内容。

import { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

import { APP_NAME, DEFAULT_APP_VERSION, DEFAULT_SETTINGS } from "../constants";
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
  const t = getTranslations(settings.language).about;

  useEffect(() => {
    let isActive = true;
    let unlisten: UnlistenFn | undefined;

    const loadAboutData = async () => {
      try {
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
        <div className="app-modal-header">
          <span className="app-modal-title">{t.title}</span>
        </div>

        <div className="app-modal-content">
          <span className="app-about-mark" aria-hidden="true" />
          <h2 className="app-modal-app-name">{APP_NAME}</h2>
          <p className="app-modal-version">{t.version(appVersion)}</p>
          <p className="app-modal-description">{t.description}</p>
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
