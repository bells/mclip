// 主窗口顶部：应用名与搜索输入框。

import type { RefObject } from "react";

import appIconUrl from "../../app-icon.png";
import { APP_NAME } from "../constants";
import type { AppTranslations } from "../i18n";
import { ui } from "../uiStyles";
import { serializeMainKeyboardNavigationTarget } from "../utils/keyboardNavigation";
import { SearchIcon } from "./UiIcons";

// Props 类型描述父组件必须传入哪些数据和回调；TypeScript 会在使用组件时检查。
type AppHeaderProps = {
  inputRef?: RefObject<HTMLInputElement | null>;
  isActive: boolean;
  searchQuery: string;
  showBrand: boolean;
  translations: AppTranslations["header"];
  onSearchTargetActivate?: (
    targetId: string,
    source: "focus" | "pointer",
  ) => void;
  onSearchQueryChange: (value: string) => void;
};

export function AppHeader({
  inputRef,
  isActive,
  searchQuery,
  showBrand,
  translations,
  onSearchTargetActivate,
  onSearchQueryChange,
}: AppHeaderProps) {
  return (
    <header className={ui.header}>
      {showBrand ? (
        <div className={ui.brand} aria-label={APP_NAME}>
          <img
            alt=""
            aria-hidden="true"
            className={ui.brandIcon}
            draggable={false}
            src={appIconUrl}
          />
          <span className={ui.kicker}>{APP_NAME}</span>
        </div>
      ) : (
        <div aria-hidden="true" className={ui.brandHidden} />
      )}
      <label className={ui.searchShell}>
        <SearchIcon className={ui.searchIcon} />
        <input
          aria-label={translations.searchPlaceholder}
          autoComplete="off"
          className={ui.search(isActive)}
          data-main-keyboard-target={serializeMainKeyboardNavigationTarget({
            kind: "search",
          })}
          // 受控组件：输入框的值来自 React state，用户输入后通过回调更新 state。
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onFocus={(event) => {
            onSearchTargetActivate?.(
              event.currentTarget.dataset.mainKeyboardTarget ?? "",
              "focus",
            );
          }}
          onPointerMove={(event) => {
            onSearchTargetActivate?.(
              event.currentTarget.dataset.mainKeyboardTarget ?? "",
              "pointer",
            );
          }}
          placeholder={translations.searchPlaceholder}
          ref={inputRef}
          type="text"
          value={searchQuery}
        />
      </label>
    </header>
  );
}
