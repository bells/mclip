// 主窗口底部菜单：清除历史、偏好设置、关于和退出。

import type { AppTranslations } from "../i18n";

// 这里把“能做什么”交给父组件实现，Footer 只负责触发对应的回调。
type AppFooterProps = {
  canClearHistory: boolean;
  translations: AppTranslations["footer"];
  onClearHistory: () => void;
  onOpenAbout: () => void;
  onOpenPreferences: () => void;
  onPointerEnter?: () => void;
  onQuit: () => void;
};

export function AppFooter({
  canClearHistory,
  translations,
  onClearHistory,
  onOpenAbout,
  onOpenPreferences,
  onPointerEnter,
  onQuit,
}: AppFooterProps) {
  return (
    <footer className="app-footer" onMouseEnter={onPointerEnter}>
      <button
        className="app-menu-item is-danger"
        // disabled 会同时禁用点击行为和键盘触发，适合空历史时避免误操作。
        disabled={!canClearHistory}
        onClick={onClearHistory}
        type="button"
      >
        <span className="app-menu-action">
          <span className="app-menu-icon app-menu-icon-clear" aria-hidden="true" />
          <span className="app-menu-label">{translations.clearLabel}</span>
        </span>
        <span className="app-menu-hint">{translations.clearHint}</span>
      </button>

      <button className="app-menu-item" onClick={onOpenPreferences} type="button">
        <span className="app-menu-action">
          <span className="app-menu-icon app-menu-icon-preferences" aria-hidden="true" />
          <span className="app-menu-label">{translations.preferencesLabel}</span>
        </span>
        <span className="app-menu-hint">{translations.preferencesHint}</span>
      </button>

      <button className="app-menu-item" onClick={onOpenAbout} type="button">
        <span className="app-menu-action">
          <span className="app-menu-icon app-menu-icon-about" aria-hidden="true" />
          <span className="app-menu-label">{translations.aboutLabel}</span>
        </span>
        <span className="app-menu-hint">{translations.aboutHint}</span>
      </button>

      <button className="app-menu-item" onClick={onQuit} type="button">
        <span className="app-menu-action">
          <span className="app-menu-icon app-menu-icon-quit" aria-hidden="true" />
          <span className="app-menu-label">{translations.quitLabel}</span>
        </span>
        <span className="app-menu-hint">{translations.quitHint}</span>
      </button>
    </footer>
  );
}
