import type { UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";

import {
  clampHistoryCount,
  DEFAULT_APP_VERSION,
  DEFAULT_SETTINGS,
  HISTORY_GROUP_SIZE,
} from "../constants";
import {
  adjustWindowHeight,
  clearHistory,
  copyToClipboard,
  getAppVersion,
  getHistory,
  getSettings,
  hideCurrentWindow,
  listenToHistoryUpdated,
  quitApp,
  saveSettings,
} from "../lib/tauri";
import type { AppSettings, HistoryListItem } from "../types";
import {
  filterHistoryItems,
  getHistoryGroupItems,
  getHistoryGroups,
} from "../utils/history";
import { getTranslations } from "../i18n";

function normalizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    language: settings.language === "zhCn" ? "zhCn" : "en",
    maxHistoryCount: clampHistoryCount(settings.maxHistoryCount),
  };
}

export function useClipboardApp() {
  const [appVersion, setAppVersion] = useState(DEFAULT_APP_VERSION);
  const [history, setHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsError, setSettingsError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [previewHistoryGroupIndex, setPreviewHistoryGroupIndex] = useState<number | null>(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const searchQueryRef = useRef(searchQuery);

  const filteredHistory = filterHistoryItems(history, searchQuery);
  const historyGroups = getHistoryGroups(filteredHistory.length, HISTORY_GROUP_SIZE);
  const visibleHistory = getHistoryGroupItems(
    filteredHistory,
    0,
    HISTORY_GROUP_SIZE,
  );
  const previewHistory = previewHistoryGroupIndex === null
    ? []
    : getHistoryGroupItems(filteredHistory, previewHistoryGroupIndex, HISTORY_GROUP_SIZE);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    let isActive = true;
    let unlisten: UnlistenFn | undefined;

    const initializeApp = async () => {
      try {
        const [loadedSettings, initialHistory, version] = await Promise.all([
          getSettings(),
          getHistory(),
          getAppVersion(),
        ]);

        if (!isActive) {
          return;
        }

        const normalizedSettings = normalizeSettings(loadedSettings);
        setAppVersion(version);
        setSettings(normalizedSettings);
        setSettingsDraft(normalizedSettings);
        setHistory(initialHistory);
      } catch (error) {
        console.error("初始化应用失败:", error);
      }
    };

    const subscribeHistoryUpdates = async () => {
      try {
        unlisten = await listenToHistoryUpdated((updatedHistory) => {
          if (isActive) {
            setHistory(updatedHistory);
            if (searchQueryRef.current.trim() === "") {
              setPreviewHistoryGroupIndex(null);
              setSelectedHistoryIndex(0);
            }
          }
        });
      } catch (error) {
        console.error("监听剪贴板历史更新失败:", error);
      }
    };

    void initializeApp();
    void subscribeHistoryUpdates();

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    void adjustWindowHeight(
      visibleHistory.length,
      historyGroups.length,
      previewHistory.length,
    ).catch((error) => {
      console.error("调整窗口高度失败:", error);
    });
  }, [historyGroups.length, previewHistory.length, visibleHistory.length]);

  useEffect(() => {
    setPreviewHistoryGroupIndex(null);
    setSelectedHistoryIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setPreviewHistoryGroupIndex(null);
    }
  }, [history.length, searchQuery]);

  useEffect(() => {
    if (
      previewHistoryGroupIndex !== null &&
      previewHistoryGroupIndex >= historyGroups.length
    ) {
      setPreviewHistoryGroupIndex(null);
    }
  }, [historyGroups.length, previewHistoryGroupIndex]);

  useEffect(() => {
    setSelectedHistoryIndex((currentIndex) => {
      if (visibleHistory.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, visibleHistory.length - 1);
    });
  }, [visibleHistory.length]);

  const openAboutDialog = () => {
    setIsAboutOpen(true);
  };

  const closeAboutDialog = () => {
    setIsAboutOpen(false);
  };

  const openPreferencesDialog = () => {
    setSettingsDraft(settings);
    setSettingsError("");
    setIsPreferencesOpen(true);
  };

  const closePreferencesDialog = () => {
    if (!isSavingSettings) {
      setIsPreferencesOpen(false);
    }
  };

  const toggleLaunchAtLogin = () => {
    setSettingsDraft((current) => ({
      ...current,
      launchAtLogin: !current.launchAtLogin,
    }));
  };

  const updateMaxHistoryCount = (nextValue: number) => {
    setSettingsDraft((current) => ({
      ...current,
      maxHistoryCount: clampHistoryCount(nextValue),
    }));
  };

  const updateLanguage = (language: AppSettings["language"]) => {
    setSettingsDraft((current) => ({
      ...current,
      language,
    }));
  };

  const savePreferences = async () => {
    try {
      setIsSavingSettings(true);
      setSettingsError("");

      const normalizedSettings = normalizeSettings(settingsDraft);
      const savedSettings = normalizeSettings(await saveSettings(normalizedSettings));

      setSettings(savedSettings);
      setSettingsDraft(savedSettings);
      setIsPreferencesOpen(false);
    } catch (error) {
      console.error("保存设置失败:", error);
      setSettingsError(getTranslations(settingsDraft.language).preferences.error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const selectHistoryItem = async (text: string) => {
    try {
      setPreviewHistoryGroupIndex(null);
      await copyToClipboard(text);
      await hideCurrentWindow();
    } catch (error) {
      console.error("复制历史记录失败:", error);
    }
  };

  const clearHistoryItems = async () => {
    try {
      await clearHistory();
      setHistory([]);
      setPreviewHistoryGroupIndex(null);
      setSelectedHistoryIndex(0);
    } catch (error) {
      console.error("清空历史失败:", error);
    }
  };

  const quit = async () => {
    try {
      await quitApp();
    } catch (error) {
      console.error("退出应用失败:", error);
    }
  };

  const hideWindow = async () => {
    try {
      setPreviewHistoryGroupIndex(null);
      await hideCurrentWindow();
    } catch (error) {
      console.error("隐藏主窗口失败:", error);
    }
  };

  const moveSelection = (offset: number) => {
    if (visibleHistory.length === 0) {
      return;
    }

    setSelectedHistoryIndex((currentIndex) => {
      const lastIndex = visibleHistory.length - 1;
      const nextIndex = currentIndex + offset;

      if (nextIndex < 0) {
        return lastIndex;
      }

      if (nextIndex > lastIndex) {
        return 0;
      }

      return nextIndex;
    });
  };

  const selectHighlightedHistoryItem = async () => {
    const selectedItem = visibleHistory[selectedHistoryIndex];

    if (selectedItem) {
      await selectHistoryItem(selectedItem.text);
    }
  };

  const openHistoryGroupPreview = (groupIndex: number) => {
    setPreviewHistoryGroupIndex(groupIndex);
  };

  const closeHistoryGroupPreview = () => {
    setPreviewHistoryGroupIndex(null);
  };

  const selectedHistoryItem: HistoryListItem | undefined = visibleHistory[selectedHistoryIndex];

  return {
    appVersion,
    visibleHistory,
    historyGroups,
    hasHistory: history.length > 0,
    isAboutOpen,
    isPreferencesOpen,
    isSavingSettings,
    previewHistory,
    previewHistoryGroupIndex,
    searchQuery,
    selectedHistoryItem,
    settings,
    settingsDraft,
    settingsError,
    clearHistory: clearHistoryItems,
    closeAboutDialog,
    closePreferencesDialog,
    closeHistoryGroupPreview,
    hideWindow,
    moveSelection,
    openAboutDialog,
    openPreferencesDialog,
    quit,
    savePreferences,
    openHistoryGroupPreview,
    selectHighlightedHistoryItem,
    selectHistoryItem,
    setSearchQuery,
    toggleLaunchAtLogin,
    updateLanguage,
    updateMaxHistoryCount,
  };
}
