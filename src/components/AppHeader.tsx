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
      <span className="app-kicker">{APP_NAME}</span>
      <input
        autoComplete="off"
        className="app-search"
        onChange={(event) => onSearchQueryChange(event.target.value)}
        placeholder={translations.searchPlaceholder}
        ref={inputRef}
        type="text"
        value={searchQuery}
      />
    </header>
  );
}
