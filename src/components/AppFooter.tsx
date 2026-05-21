// 主窗口底部菜单：清除历史、偏好设置、关于和退出。

import type { AppTranslations } from "../i18n";

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
