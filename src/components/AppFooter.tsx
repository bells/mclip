// 主窗口底部菜单：清除历史、偏好设置、关于和退出。

import type { AppTranslations } from "../i18n";

type AppFooterProps = {
  translations: AppTranslations["footer"];
  onClearHistory: () => void;
  onOpenAbout: () => void;
  onOpenPreferences: () => void;
  onPointerEnter?: () => void;
  onQuit: () => void;
};

export function AppFooter({
  translations,
  onClearHistory,
  onOpenAbout,
  onOpenPreferences,
  onPointerEnter,
  onQuit,
}: AppFooterProps) {
  return (
    <footer className="app-footer" onMouseEnter={onPointerEnter}>
      <button className="app-menu-item is-danger" onClick={onClearHistory} type="button">
        <span className="app-menu-label">{translations.clearLabel}</span>
        <span className="app-menu-hint">{translations.clearHint}</span>
      </button>

      <button className="app-menu-item" onClick={onOpenPreferences} type="button">
        <span className="app-menu-label">{translations.preferencesLabel}</span>
        <span className="app-menu-hint">{translations.preferencesHint}</span>
      </button>

      <button className="app-menu-item" onClick={onOpenAbout} type="button">
        <span className="app-menu-label">{translations.aboutLabel}</span>
        <span className="app-menu-hint">{translations.aboutHint}</span>
      </button>

      <button className="app-menu-item" onClick={onQuit} type="button">
        <span className="app-menu-label">{translations.quitLabel}</span>
        <span className="app-menu-hint">{translations.quitHint}</span>
      </button>
    </footer>
  );
}
