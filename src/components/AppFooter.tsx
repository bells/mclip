// 主窗口底部菜单：清除历史、偏好设置、关于和退出。

import type { AppTranslations } from "../i18n";
import { menuItem, ui } from "../uiStyles";
import {
  type FooterKeyboardAction,
  serializeMainKeyboardNavigationTarget,
} from "../utils/keyboardNavigation";
import {
  type MainWindowShortcutAction,
  getMainWindowShortcutAriaKeys,
  getMainWindowShortcutKeys,
} from "../utils/mainWindowShortcuts";

function ShortcutKeys({ action }: { action: MainWindowShortcutAction }) {
  return (
    <kbd aria-hidden="true" className={ui.menuShortcut}>
      {getMainWindowShortcutKeys(action).map((key, index) => (
        <span className={ui.menuShortcutKey} key={`${key}-${index}`}>
          {key}
        </span>
      ))}
    </kbd>
  );
}

// 这里把“能做什么”交给父组件实现，Footer 只负责触发对应的回调。
type AppFooterProps = {
  canClearHistory: boolean;
  selectedAction?: FooterKeyboardAction;
  translations: AppTranslations["footer"];
  onClearHistory: () => void;
  onTargetActivate?: (
    targetId: string,
    source: "focus" | "pointer",
  ) => void;
  onOpenAbout: () => void;
  onOpenPreferences: () => void;
  onPreviewDismissRequest?: () => void;
  onQuit: () => void;
};

export function AppFooter({
  canClearHistory,
  selectedAction,
  translations,
  onClearHistory,
  onTargetActivate,
  onOpenAbout,
  onOpenPreferences,
  onPreviewDismissRequest,
  onQuit,
}: AppFooterProps) {
  const activateTarget = (
    element: HTMLButtonElement,
    source: "focus" | "pointer",
  ) => {
    if (element.disabled) {
      return;
    }

    onTargetActivate?.(element.dataset.mainKeyboardTarget ?? "", source);
  };

  return (
    <footer
      className={ui.footer}
      onFocus={onPreviewDismissRequest}
      onMouseEnter={onPreviewDismissRequest}
    >
      <button
        className={menuItem(selectedAction === "clearHistory", true, !canClearHistory)}
        data-main-keyboard-target={serializeMainKeyboardNavigationTarget({
          action: "clearHistory",
          kind: "footer-action",
        })}
        aria-keyshortcuts={getMainWindowShortcutAriaKeys("clearHistory")}
        // disabled 会同时禁用点击行为和键盘触发，适合空历史时避免误操作。
        disabled={!canClearHistory}
        onClick={onClearHistory}
        onFocus={(event) => activateTarget(event.currentTarget, "focus")}
        onPointerMove={(event) => activateTarget(event.currentTarget, "pointer")}
        type="button"
      >
        <span className={ui.menuLabel}>{translations.clearLabel}</span>
        <ShortcutKeys action="clearHistory" />
      </button>

      <button
        className={menuItem(selectedAction === "preferences", false)}
        data-main-keyboard-target={serializeMainKeyboardNavigationTarget({
          action: "preferences",
          kind: "footer-action",
        })}
        aria-keyshortcuts={getMainWindowShortcutAriaKeys("preferences")}
        onClick={onOpenPreferences}
        onFocus={(event) => activateTarget(event.currentTarget, "focus")}
        onPointerMove={(event) => activateTarget(event.currentTarget, "pointer")}
        type="button"
      >
        <span className={ui.menuLabel}>{translations.preferencesLabel}</span>
        <ShortcutKeys action="preferences" />
      </button>

      <button
        className={menuItem(selectedAction === "about", false)}
        data-main-keyboard-target={serializeMainKeyboardNavigationTarget({
          action: "about",
          kind: "footer-action",
        })}
        onClick={onOpenAbout}
        onFocus={(event) => activateTarget(event.currentTarget, "focus")}
        onPointerMove={(event) => activateTarget(event.currentTarget, "pointer")}
        type="button"
      >
        <span className={ui.menuLabel}>{translations.aboutLabel}</span>
      </button>

      <button
        className={menuItem(selectedAction === "quit", false)}
        data-main-keyboard-target={serializeMainKeyboardNavigationTarget({
          action: "quit",
          kind: "footer-action",
        })}
        aria-keyshortcuts={getMainWindowShortcutAriaKeys("quit")}
        onClick={onQuit}
        onFocus={(event) => activateTarget(event.currentTarget, "focus")}
        onPointerMove={(event) => activateTarget(event.currentTarget, "pointer")}
        type="button"
      >
        <span className={ui.menuLabel}>{translations.quitLabel}</span>
        <ShortcutKeys action="quit" />
      </button>
    </footer>
  );
}
