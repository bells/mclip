import { useEffect, useRef } from "react";

import { AboutDialog } from "./components/AboutDialog";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { HistoryGroupNav } from "./components/HistoryGroupNav";
import { HistoryList } from "./components/HistoryList";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { useClipboardApp } from "./hooks/useClipboardApp";
import { listenToMainWindowShown } from "./lib/tauri";

function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    appVersion,
    filteredHistory,
    historyGroups,
    hasHistory,
    isAboutOpen,
    isPreferencesOpen,
    isSavingSettings,
    previewHistory,
    previewHistoryGroupIndex,
    searchQuery,
    selectedHistoryItem,
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
    toggleLaunchAtLogin,
    updateMaxHistoryCount,
  } = useClipboardApp();

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
          onSearchQueryChange={setSearchQuery}
        />

        <div className="app-body">
          <HistoryList
            hasHistory={hasHistory}
            items={filteredHistory}
            onSelectItem={selectHistoryItem}
            selectedItemId={selectedHistoryItem?.id}
          />
        </div>

        <HistoryGroupNav
          groups={historyGroups}
          previewGroupIndex={previewHistoryGroupIndex}
          previewItems={previewHistory}
          onClosePreview={closeHistoryGroupPreview}
          onOpenPreview={openHistoryGroupPreview}
          onSelectItem={selectHistoryItem}
        />

        <AppFooter
          onClearHistory={clearHistory}
          onOpenAbout={openAboutDialog}
          onOpenPreferences={openPreferencesDialog}
          onQuit={quit}
        />
      </div>

      {isAboutOpen ? (
        <AboutDialog appVersion={appVersion} onClose={closeAboutDialog} />
      ) : null}

      {isPreferencesOpen ? (
        <PreferencesDialog
          errorMessage={settingsError}
          isSaving={isSavingSettings}
          settings={settingsDraft}
          onClose={closePreferencesDialog}
          onSave={savePreferences}
          onToggleLaunchAtLogin={toggleLaunchAtLogin}
          onUpdateMaxHistoryCount={updateMaxHistoryCount}
        />
      ) : null}
    </div>
  );
}

export default App;
