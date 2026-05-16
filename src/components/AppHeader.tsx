import type { RefObject } from "react";

import { APP_NAME } from "../constants";

type AppHeaderProps = {
  inputRef?: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
};

export function AppHeader({
  inputRef,
  searchQuery,
  onSearchQueryChange,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <span className="app-kicker">{APP_NAME}</span>
      <input
        autoComplete="off"
        className="app-search"
        onChange={(event) => onSearchQueryChange(event.target.value)}
        placeholder="搜索剪贴板历史..."
        ref={inputRef}
        type="text"
        value={searchQuery}
      />
    </header>
  );
}
