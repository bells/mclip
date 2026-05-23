// 应用根组件。根据 Tauri 当前窗口 label，在主界面和独立 preview 窗口之间切换渲染。

import { useEffect, useRef, useState } from "react";

import { AboutWindow } from "./components/AboutWindow";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { HistoryPreviewWindow } from "./components/HistoryPreviewWindow";
import { HistoryGroupNav } from "./components/HistoryGroupNav";
import { HistoryList } from "./components/HistoryList";
import { Modal } from "./components/Modal";
import { PreferencesWindow } from "./components/PreferencesWindow";
import { useClipboardApp } from "./hooks/useClipboardApp";
import { getTranslations } from "./i18n";
import { getCurrentWindowLabel, listenToMainWindowShown } from "./lib/tauri";

function App() {
  const windowLabel = getCurrentWindowLabel();

  if (windowLabel === "preview") {
    return <HistoryPreviewWindow />;
  }

  if (windowLabel === "about") {
    return <AboutWindow />;
  }

  if (windowLabel === "preferences") {
    return <PreferencesWindow />;
  }

  return <MainWindow />;
}

function MainWindow() {
  // 主窗口负责管理完整应用状态；preview 窗口只接收主窗口发过去的展示数据。
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const {
    visibleHistory,
    historyGroups,
    hasHistory,
    previewHistoryGroupIndex,
    searchQuery,
    selectedHistoryItem,
    settings,
    clearHistory,
    closeHistoryGroupPreview,
    deleteHistoryItem,
    hideWindow,
    moveSelection,
    openAboutDialog,
    openHistoryGroupPreview,
    openHistoryItemPreview,
    openPreferencesDialog,
    quit,
    selectHighlightedHistoryItem,
    selectHistoryItem,
    setSearchQuery,
    scheduleHistoryGroupPreviewClose,
  } = useClipboardApp();
  const t = getTranslations(settings.language);

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

        if (isClearConfirmOpen) {
          setIsClearConfirmOpen(false);
          return;
        }

        // 主窗口内只保留分组 preview 这一层浮层；偏好设置和关于已拆到独立窗口。
        if (previewHistoryGroupIndex !== null) {
          closeHistoryGroupPreview();
          return;
        }

        void hideWindow();
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
    closeHistoryGroupPreview,
    hideWindow,
    isClearConfirmOpen,
    moveSelection,
    openPreferencesDialog,
    previewHistoryGroupIndex,
    selectHighlightedHistoryItem,
  ]);

  const openClearHistoryConfirm = () => {
    if (!hasHistory) {
      return;
    }

    closeHistoryGroupPreview();
    setIsClearConfirmOpen(true);
  };

  const confirmClearHistory = () => {
    setIsClearConfirmOpen(false);
    void clearHistory();
  };

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
            onDeleteItem={deleteHistoryItem}
            onOpenItemPreview={openHistoryItemPreview}
            onScheduleClosePreview={scheduleHistoryGroupPreviewClose}
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
          canClearHistory={hasHistory}
          translations={t.footer}
          onClearHistory={openClearHistoryConfirm}
          onOpenAbout={openAboutDialog}
          onOpenPreferences={openPreferencesDialog}
          onPointerEnter={closeHistoryGroupPreview}
          onQuit={quit}
        />

        {isClearConfirmOpen ? (
          <Modal
            className="app-clear-confirm-modal"
            footer={
              <>
                <button
                  className="app-modal-secondary-btn"
                  onClick={() => setIsClearConfirmOpen(false)}
                  type="button"
                >
                  {t.clearHistoryConfirm.cancel}
                </button>
                <button
                  className="app-modal-btn app-modal-danger-btn"
                  onClick={confirmClearHistory}
                  type="button"
                >
                  {t.clearHistoryConfirm.confirm}
                </button>
              </>
            }
            onRequestClose={() => setIsClearConfirmOpen(false)}
            title={t.clearHistoryConfirm.title}
          >
            <div className="app-clear-confirm">
              <span className="app-clear-confirm-mark" aria-hidden="true" />
              <p className="app-clear-confirm-message">
                {t.clearHistoryConfirm.message}
              </p>
            </div>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}

export default App;
