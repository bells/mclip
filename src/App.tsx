// 应用根组件。根据 Tauri 当前窗口 label，在主界面和独立 preview 窗口之间切换渲染。

import { useEffect, useRef, useState } from "react";

import { AboutWindow } from "./components/AboutWindow";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { HistoryPreviewWindow } from "./components/HistoryPreviewWindow";
import { HistoryPreviewDetailWindow } from "./components/HistoryPreviewDetailWindow";
import { HistoryGroupNav } from "./components/HistoryGroupNav";
import { HistoryList } from "./components/HistoryList";
import { Modal } from "./components/Modal";
import { PreferencesWindow } from "./components/PreferencesWindow";
import { useClipboardApp } from "./hooks/useClipboardApp";
import { getTranslations } from "./i18n";
import { getCurrentWindowLabel, listenToMainWindowShown } from "./lib/tauri";

function App() {
  const windowLabel = getCurrentWindowLabel();

  // Tauri 的每个窗口都会加载同一份前端入口，这里按窗口 label 决定实际渲染哪个组件。
  if (windowLabel === "preview") {
    return <HistoryPreviewWindow />;
  }

  if (windowLabel === "preview-detail") {
    return <HistoryPreviewDetailWindow />;
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
  // useRef 保存 DOM 节点引用；改变 ref.current 不会触发组件重新渲染。
  const searchInputRef = useRef<HTMLInputElement>(null);
  // useState 适合保存会影响界面的状态。这里的 boolean 控制确认弹窗是否显示。
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  // 自定义 Hook 把剪贴板历史、设置、窗口命令等逻辑集中起来，组件只负责组装界面。
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
    // 第二个参数是空数组，表示这个 effect 只在组件首次挂载后执行一次。
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Tauri 事件监听是异步注册的，所以先保存取消监听函数，卸载组件时再调用。
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
      // 浏览器键盘事件来自 DOM，不是 React 的合成事件，所以类型是 KeyboardEvent。
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
    // 打开模态框前先关闭右侧 preview，避免两个浮层同时响应鼠标事件。
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

        {/* JSX 里用三元表达式做条件渲染；不显示时返回 null。 */}
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
