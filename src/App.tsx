// 应用根组件。根据 Tauri 当前窗口 label，在主界面和独立 preview 窗口之间切换渲染。

import { useEffect, useRef } from "react";

import { AboutDialog } from "./components/AboutDialog";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { HistoryPreviewWindow } from "./components/HistoryPreviewWindow";
import { HistoryGroupNav } from "./components/HistoryGroupNav";
import { HistoryList } from "./components/HistoryList";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { useClipboardApp } from "./hooks/useClipboardApp";
import { getTranslations } from "./i18n";
import { getCurrentWindowLabel, listenToMainWindowShown } from "./lib/tauri";

function App() {
  return getCurrentWindowLabel() === "preview" ? <HistoryPreviewWindow /> : <MainWindow />;
}

function MainWindow() {
  // 主窗口负责管理完整应用状态；preview 窗口只接收主窗口发过去的展示数据。
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    appVersion,
    visibleHistory,
    historyGroups,
    hasHistory,
    isAboutOpen,
    isPreferencesOpen,
    isSavingSettings,
    previewHistoryGroupIndex,
    searchQuery,
    selectedHistoryItem,
    settings,
    settingsDraft,
    settingsError,
    clearHistory,
    closeAboutDialog,
    closeHistoryGroupPreview,
    closePreferencesDialog,
    hideWindow,
    moveSelection,
    openAboutDialog,
    openHistoryGroupPreview,
    openPreferencesDialog,
    quit,
    savePreferences,
    selectHighlightedHistoryItem,
    selectHistoryItem,
    setSearchQuery,
    scheduleHistoryGroupPreviewClose,
    toggleLaunchAtLogin,
    updateLanguage,
    updateMaxHistoryCount,
  } = useClipboardApp();
  const displayLanguage = isPreferencesOpen ? settingsDraft.language : settings.language;
  const t = getTranslations(displayLanguage);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenToMainWindowShown(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const hasMetaModifier = event.metaKey || event.ctrlKey;
      const normalizedKey = event.key.toLowerCase();

      if (event.key === "Escape") {
        event.preventDefault();

        // Escape 从最浮层开始关闭，最后才隐藏整个主窗口。
        if (previewHistoryGroupIndex !== null) {
          closeHistoryGroupPreview();
          return;
        }

        if (isAboutOpen) {
          closeAboutDialog();
          return;
        }

        if (isPreferencesOpen) {
          closePreferencesDialog();
          return;
        }

        void hideWindow();
        return;
      }

      if (isAboutOpen || isPreferencesOpen) {
        return;
      }

      if (hasMetaModifier && normalizedKey === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (hasMetaModifier && event.key === ",") {
        event.preventDefault();
        openPreferencesDialog();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void selectHighlightedHistoryItem();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeAboutDialog,
    closeHistoryGroupPreview,
    closePreferencesDialog,
    hideWindow,
    isAboutOpen,
    isPreferencesOpen,
    moveSelection,
    openPreferencesDialog,
    previewHistoryGroupIndex,
    selectHighlightedHistoryItem,
  ]);

  return (
    <div className="app-frame">
      <div className="app-panel">
        <AppHeader
          inputRef={searchInputRef}
          searchQuery={searchQuery}
          translations={t.header}
          onSearchQueryChange={setSearchQuery}
        />

        <div className="app-body">
          <HistoryList
          hasHistory={hasHistory}
          items={visibleHistory}
          translations={t.history}
          onSelectItem={selectHistoryItem}
          selectedItemId={selectedHistoryItem?.id}
        />
        </div>

        <HistoryGroupNav
          groups={historyGroups}
          previewGroupIndex={previewHistoryGroupIndex}
          translations={t.history}
          onOpenPreview={openHistoryGroupPreview}
          onScheduleClosePreview={scheduleHistoryGroupPreviewClose}
        />

        <AppFooter
          translations={t.footer}
          onClearHistory={clearHistory}
          onOpenAbout={openAboutDialog}
          onOpenPreferences={openPreferencesDialog}
          onPointerEnter={closeHistoryGroupPreview}
          onQuit={quit}
        />
      </div>

      {isAboutOpen ? (
        <AboutDialog
          appVersion={appVersion}
          translations={t.about}
          onClose={closeAboutDialog}
        />
      ) : null}

      {isPreferencesOpen ? (
        <PreferencesDialog
          errorMessage={settingsError}
          isSaving={isSavingSettings}
          settings={settingsDraft}
          translations={t.preferences}
          onClose={closePreferencesDialog}
          onSave={savePreferences}
          onToggleLaunchAtLogin={toggleLaunchAtLogin}
          onUpdateLanguage={updateLanguage}
          onUpdateMaxHistoryCount={updateMaxHistoryCount}
        />
      ) : null}
    </div>
  );
}

export default App;
