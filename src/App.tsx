// 应用根组件。根据 Tauri 当前窗口 label，在主界面和独立 preview 窗口之间切换渲染。

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { AboutWindow } from "./components/AboutWindow";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { HistoryPreviewWindow } from "./components/HistoryPreviewWindow";
import { HistoryPreviewDetailWindow } from "./components/HistoryPreviewDetailWindow";
import { HistoryGroupNav } from "./components/HistoryGroupNav";
import { HistoryList } from "./components/HistoryList";
import { Modal } from "./components/Modal";
import { PreferencesWindow } from "./components/PreferencesWindow";
import { AlertIcon } from "./components/UiIcons";
import { useApplyAppTheme } from "./hooks/useApplyAppTheme";
import { useClipboardApp } from "./hooks/useClipboardApp";
import { getTranslations } from "./i18n";
import {
  getCurrentWindowLabel,
  listenToHistoryPreviewGroupItemActivated,
  listenToMainWindowShown,
  sendHistoryPreviewKeyboardNavigation,
} from "./lib/tauri";
import { adjustWindowHeightToContent } from "./services/ipc/commands";
import {
  getGroupPreviewEntryKey,
  getGroupPreviewReturnKey,
  getNextMainKeyboardNavigationTarget,
  parseMainKeyboardNavigationTarget,
  serializeMainKeyboardNavigationTarget,
  shouldClearPreviewForMainKeyboardTarget,
} from "./utils/keyboardNavigation";
import { ui } from "./uiStyles";

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
  const [keyboardPreviewGroupIndex, setKeyboardPreviewGroupIndex] =
    useState<number | null>(null);
  const [activeMainKeyboardTargetId, setActiveMainKeyboardTargetId] =
    useState<string | null>(null);
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);
  const activeMainKeyboardTargetIdRef = useRef<string | null>(null);
  const headerMeasureRef = useRef<HTMLDivElement | null>(null);
  const contentMeasureRef = useRef<HTMLDivElement | null>(null);
  const footerMeasureRef = useRef<HTMLDivElement | null>(null);
  const lastMeasuredWindowHeightRef = useRef<number | null>(null);
  // 自定义 Hook 把剪贴板历史、设置、窗口命令等逻辑集中起来，组件只负责组装界面。
  const {
    visibleHistory,
    historyGroups,
    hasHistory,
    previewHistoryGroupIndex,
    previewWindowSide,
    searchQuery,
    settings,
    clearHistory,
    closeHistoryGroupPreview,
    deleteHistoryItem,
    hideWindow,
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
  useApplyAppTheme(settings.appearanceTheme);
  const t = getTranslations(settings.language);

  const measureAndApplyMainWindowHeight = useCallback(() => {
    const headerHeight = headerMeasureRef.current?.getBoundingClientRect().height ?? 0;
    const contentHeight = contentMeasureRef.current?.scrollHeight ?? 0;
    const footerHeight = footerMeasureRef.current?.getBoundingClientRect().height ?? 0;
    const contentWindowHeight = Math.ceil(headerHeight + contentHeight + footerHeight);

    if (contentWindowHeight <= 0) {
      return;
    }

    if (lastMeasuredWindowHeightRef.current === contentWindowHeight) {
      return;
    }

    lastMeasuredWindowHeightRef.current = contentWindowHeight;
    void adjustWindowHeightToContent(contentWindowHeight).catch((error) => {
      console.error("按内容调整窗口高度失败:", error);
    });
  }, []);

  useLayoutEffect(() => {
    let animationFrameId: number | null = null;
    const observedElements = [
      headerMeasureRef.current,
      contentMeasureRef.current,
      footerMeasureRef.current,
    ].filter((element): element is HTMLDivElement => element !== null);
    const scheduleMeasurement = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        measureAndApplyMainWindowHeight();
      });
    };

    scheduleMeasurement();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", scheduleMeasurement);

      return () => {
        window.removeEventListener("resize", scheduleMeasurement);

        if (animationFrameId !== null) {
          window.cancelAnimationFrame(animationFrameId);
        }
      };
    }

    const resizeObserver = new ResizeObserver(scheduleMeasurement);
    observedElements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("resize", scheduleMeasurement);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasurement);

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    hasHistory,
    historyGroups.length,
    measureAndApplyMainWindowHeight,
    searchQuery,
    settings.showHistoryItemNumbers,
    visibleHistory.length,
  ]);

  const updateActiveMainKeyboardTarget = useCallback((targetId: string | null) => {
    activeMainKeyboardTargetIdRef.current = targetId;
    setActiveMainKeyboardTargetId(targetId);
  }, []);

  const focusKeyboardNavigationTarget = useCallback((targetId: string) => {
    updateActiveMainKeyboardTarget(targetId);

    const targetElement = Array.from(
      document.querySelectorAll<HTMLElement>("[data-main-keyboard-target]"),
    ).find((element) => element.dataset.mainKeyboardTarget === targetId);

    targetElement?.focus();
    targetElement?.scrollIntoView({ block: "nearest" });
  }, [updateActiveMainKeyboardTarget]);

  const clearKeyboardPreviewGroup = useCallback((groupIndex: number | null) => {
    setKeyboardPreviewGroupIndex(null);

    if (groupIndex !== null) {
      void sendHistoryPreviewKeyboardNavigation({
        groupIndex,
        kind: "clear-group-item",
      });
    }
  }, []);

  const activePreviewSide = previewWindowSide;

  const enterKeyboardPreviewGroup = useCallback((groupIndex: number) => {
    setKeyboardPreviewGroupIndex(groupIndex);
    void sendHistoryPreviewKeyboardNavigation({
      groupIndex,
      kind: "activate-first-group-item",
    });
  }, []);

  const moveKeyboardPreviewGroupItem = useCallback(
    (groupIndex: number, offset: -1 | 1) => {
      void sendHistoryPreviewKeyboardNavigation({
        groupIndex,
        kind: "move-group-item",
        offset,
      });
    },
    [],
  );

  const selectKeyboardPreviewGroupItem = useCallback((groupIndex: number) => {
    void sendHistoryPreviewKeyboardNavigation({
      groupIndex,
      kind: "select-group-item",
    });
  }, []);

  const handleSearchFocus = useCallback(
    (targetId: string) => {
      updateActiveMainKeyboardTarget(targetId);

      if (!shouldClearPreviewForMainKeyboardTarget(targetId)) {
        return;
      }

      clearKeyboardPreviewGroup(keyboardPreviewGroupIndex);
      closeHistoryGroupPreview();
    },
    [
      clearKeyboardPreviewGroup,
      closeHistoryGroupPreview,
      keyboardPreviewGroupIndex,
      updateActiveMainKeyboardTarget,
    ],
  );

  const moveKeyboardNavigationFocus = useCallback(
    (direction: -1 | 1) => {
      setIsKeyboardNavigating(true);

      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const currentTargetId =
        activeMainKeyboardTargetIdRef.current ??
        activeElement?.dataset.mainKeyboardTarget ??
        null;

      const nextTarget = getNextMainKeyboardNavigationTarget(
        currentTargetId,
        direction,
        {
          canClearHistory: hasHistory,
          historyGroupCount: historyGroups.length,
          visibleHistoryCount: visibleHistory.length,
        },
      );

      if (nextTarget === null) {
        return;
      }

      focusKeyboardNavigationTarget(
        serializeMainKeyboardNavigationTarget(nextTarget),
      );
    },
    [
      focusKeyboardNavigationTarget,
      hasHistory,
      historyGroups.length,
      visibleHistory.length,
    ],
  );

  useEffect(() => {
    // 第二个参数是空数组，表示这个 effect 只在组件首次挂载后执行一次。
    updateActiveMainKeyboardTarget(
      serializeMainKeyboardNavigationTarget({ kind: "search" }),
    );
    searchInputRef.current?.focus();
  }, [updateActiveMainKeyboardTarget]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Tauri 事件监听是异步注册的，所以先保存取消监听函数，卸载组件时再调用。
    void listenToMainWindowShown(() => {
      updateActiveMainKeyboardTarget(
        serializeMainKeyboardNavigationTarget({ kind: "search" }),
      );
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
    };
  }, [updateActiveMainKeyboardTarget]);

  useEffect(() => {
    if (previewHistoryGroupIndex === null) {
      setKeyboardPreviewGroupIndex(null);
    }
  }, [previewHistoryGroupIndex]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenToHistoryPreviewGroupItemActivated(({ groupIndex }) => {
      if (previewHistoryGroupIndex === groupIndex) {
        setKeyboardPreviewGroupIndex(groupIndex);
      }
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
    };
  }, [previewHistoryGroupIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 浏览器键盘事件来自 DOM，不是 React 的合成事件，所以类型是 KeyboardEvent。
      const hasMetaModifier = event.metaKey || event.ctrlKey;
      const normalizedKey = event.key.toLowerCase();
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeTargetId =
        activeMainKeyboardTargetIdRef.current ??
        activeElement?.dataset.mainKeyboardTarget;
      const activeTarget = parseMainKeyboardNavigationTarget(
        activeTargetId,
      );

      if (event.key === "Escape") {
        event.preventDefault();

        if (isClearConfirmOpen) {
          setIsClearConfirmOpen(false);
          return;
        }

        // 主窗口内只保留分组 preview 这一层浮层；偏好设置和关于已拆到独立窗口。
        if (previewHistoryGroupIndex !== null) {
          clearKeyboardPreviewGroup(keyboardPreviewGroupIndex);
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

      if (keyboardPreviewGroupIndex !== null) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveKeyboardPreviewGroupItem(keyboardPreviewGroupIndex, 1);
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveKeyboardPreviewGroupItem(keyboardPreviewGroupIndex, -1);
          return;
        }

        if (
          activePreviewSide !== null &&
          event.key === getGroupPreviewReturnKey(activePreviewSide)
        ) {
          event.preventDefault();
          clearKeyboardPreviewGroup(keyboardPreviewGroupIndex);
          focusKeyboardNavigationTarget(
            serializeMainKeyboardNavigationTarget({
              groupIndex: keyboardPreviewGroupIndex,
              kind: "history-group",
            }),
          );
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          selectKeyboardPreviewGroupItem(keyboardPreviewGroupIndex);
          return;
        }
      }

      if (
        activeTarget?.kind === "history-group" &&
        activePreviewSide !== null &&
        previewHistoryGroupIndex === activeTarget.groupIndex &&
        event.key === getGroupPreviewEntryKey(activePreviewSide)
      ) {
        event.preventDefault();
        enterKeyboardPreviewGroup(activeTarget.groupIndex);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveKeyboardNavigationFocus(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveKeyboardNavigationFocus(-1);
        return;
      }

      if (event.key === "Enter") {
        if (event.target instanceof HTMLButtonElement) {
          return;
        }

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
    clearKeyboardPreviewGroup,
    activePreviewSide,
    enterKeyboardPreviewGroup,
    focusKeyboardNavigationTarget,
    hideWindow,
    isClearConfirmOpen,
    keyboardPreviewGroupIndex,
    moveKeyboardPreviewGroupItem,
    moveKeyboardNavigationFocus,
    openPreferencesDialog,
    previewHistoryGroupIndex,
    selectKeyboardPreviewGroupItem,
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

  const activeMainKeyboardTarget = parseMainKeyboardNavigationTarget(
    activeMainKeyboardTargetId,
  );
  const activeHistoryItemId =
    activeMainKeyboardTarget?.kind === "history-item"
      ? visibleHistory[activeMainKeyboardTarget.index]?.id ?? null
      : null;
  const activeFooterAction =
    activeMainKeyboardTarget?.kind === "footer-action"
      ? activeMainKeyboardTarget.action
      : undefined;

  const openHistoryItemPreviewFromTarget = (
    item: (typeof visibleHistory)[number],
    anchorTop: number,
    targetId: string,
  ) => {
    clearKeyboardPreviewGroup(keyboardPreviewGroupIndex);
    updateActiveMainKeyboardTarget(targetId);
    openHistoryItemPreview(item, anchorTop);
  };

  const openHistoryGroupPreviewFromTarget = (
    groupIndex: number,
    anchorTop: number,
    targetId: string,
  ) => {
    clearKeyboardPreviewGroup(keyboardPreviewGroupIndex);
    updateActiveMainKeyboardTarget(targetId);
    openHistoryGroupPreview(groupIndex, anchorTop);
  };

  const handleFooterKeyboardTargetChange = (targetId: string) => {
    clearKeyboardPreviewGroup(keyboardPreviewGroupIndex);
    updateActiveMainKeyboardTarget(targetId);
  };

  return (
    <div
      className={ui.appFrame}
      onPointerMove={() => setIsKeyboardNavigating(false)}
    >
      <div className={ui.appPanel}>
        <div className={ui.mainHeaderMeasure} ref={headerMeasureRef}>
          <AppHeader
            inputRef={searchInputRef}
            searchQuery={searchQuery}
            translations={t.header}
            onSearchFocus={handleSearchFocus}
            onSearchQueryChange={setSearchQuery}
          />
        </div>

        <div className={ui.mainScrollRegion}>
          <div className={ui.mainScrollContent} ref={contentMeasureRef}>
            <div className={ui.appBody}>
              <HistoryList
                hasHistory={hasHistory}
                isKeyboardNavigating={isKeyboardNavigating}
                items={visibleHistory}
                translations={t.history}
                onDeleteItem={deleteHistoryItem}
                onOpenItemPreview={openHistoryItemPreviewFromTarget}
                onScheduleClosePreview={scheduleHistoryGroupPreviewClose}
                onSelectItem={selectHistoryItem}
                showItemNumbers={settings.showHistoryItemNumbers}
                selectedItemId={activeHistoryItemId ?? undefined}
              />
            </div>

            <HistoryGroupNav
              groups={historyGroups}
              previewGroupIndex={previewHistoryGroupIndex}
              translations={t.history}
              onOpenPreview={openHistoryGroupPreviewFromTarget}
              onScheduleClosePreview={scheduleHistoryGroupPreviewClose}
            />
          </div>
        </div>

        <div className={ui.mainFooterMeasure} ref={footerMeasureRef}>
          <AppFooter
            canClearHistory={hasHistory}
            selectedAction={activeFooterAction}
            translations={t.footer}
            onClearHistory={openClearHistoryConfirm}
            onKeyboardTargetChange={handleFooterKeyboardTargetChange}
            onOpenAbout={openAboutDialog}
            onOpenPreferences={openPreferencesDialog}
            onPreviewDismissRequest={closeHistoryGroupPreview}
            onQuit={quit}
          />
        </div>

        {/* JSX 里用三元表达式做条件渲染；不显示时返回 null。 */}
        {isClearConfirmOpen ? (
          <Modal
            className={ui.clearConfirmModal}
            footer={
              <>
                <button
                  className={`${ui.modalButton} ${ui.modalSecondaryButton}`}
                  onClick={() => setIsClearConfirmOpen(false)}
                  type="button"
                >
                  {t.clearHistoryConfirm.cancel}
                </button>
                <button
                  className={`${ui.modalButton} ${ui.modalDangerButton}`}
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
            <div className={ui.clearConfirm}>
              <span className={ui.clearConfirmMark} aria-hidden="true">
                <AlertIcon className="size-4" />
              </span>
              <p className={ui.clearConfirmMessage}>
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
