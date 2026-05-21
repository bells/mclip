// 主窗口顶部：应用名与搜索输入框。

import type { RefObject } from "react";

import { APP_NAME } from "../constants";
import type { AppTranslations } from "../i18n";

type AppHeaderProps = {
  inputRef?: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  translations: AppTranslations["header"];
  onSearchQueryChange: (value: string) => void;
};

export function AppHeader({
  inputRef,
  searchQuery,
  translations,
  onSearchQueryChange,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-brand" aria-label={APP_NAME}>
        <span className="app-brand-mark" aria-hidden="true" />
        <span className="app-kicker">{APP_NAME}</span>
      </div>
      <label className="app-search-shell">
        <span className="app-search-icon" aria-hidden="true" />
        <input
          autoComplete="off"
          className="app-search"
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={translations.searchPlaceholder}
          ref={inputRef}
          type="text"
          value={searchQuery}
        />
      </label>
    </header>
  );
}
