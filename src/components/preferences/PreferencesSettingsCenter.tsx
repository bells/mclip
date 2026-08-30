import { useMemo, useRef, useState, type ReactNode } from "react";

import type { AppTranslations } from "../../i18n";
import { ui } from "../../uiStyles";
import {
  createPreferenceSettingIndex,
  filterPreferenceSettings,
  type PreferencesDestination,
  type PreferencesDestinationId,
} from "./preferencesNavigation";

type PreferencesSettingsCenterProps = {
  activeDestinationId: PreferencesDestinationId;
  children: ReactNode;
  destinations: readonly PreferencesDestination[];
  onDestinationChange: (destinationId: PreferencesDestinationId) => void;
  translations: AppTranslations["preferences"];
};

export function PreferencesSettingsCenter({
  activeDestinationId,
  children,
  destinations,
  onDestinationChange,
  translations,
}: PreferencesSettingsCenterProps) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const settingIndex = useMemo(
    () =>
      createPreferenceSettingIndex(
        destinations,
        (key) => translations[key] as string,
      ),
    [destinations, translations],
  );
  const results = useMemo(
    () => filterPreferenceSettings(settingIndex, query),
    [query, settingIndex],
  );

  const activateResult = (destinationId: PreferencesDestinationId, targetId: string) => {
    onDestinationChange(destinationId);
    setQuery("");
    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView({ block: "center" });
      const control = target?.querySelector<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      control?.focus();
    });
  };

  return (
    <div
      className={ui.preferencesSettingsCenter}
      onKeyDown={(event) => {
        if (event.key === "Escape" && query) {
          event.preventDefault();
          event.stopPropagation();
          setQuery("");
          searchRef.current?.focus();
        }
      }}
    >
      <aside className={ui.preferencesSidebar}>
        <div className={ui.preferencesSearchArea}>
          <label className={ui.srOnly} htmlFor="preferences-search">
            {translations.searchLabel}
          </label>
          <input
            className={ui.preferencesSearch}
            id="preferences-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translations.searchPlaceholder}
            ref={searchRef}
            type="search"
            value={query}
          />
        </div>

        {query ? (
          <div aria-label={translations.searchLabel} className={ui.preferencesSearchResults}>
            {results.length === 0 ? (
              <div className={ui.preferencesSearchEmpty}>{translations.searchEmpty}</div>
            ) : (
              results.map((result) => (
                <button
                  className={ui.preferencesSearchResult}
                  key={result.id}
                  onClick={() =>
                    activateResult(result.destinationId, result.focusTargetId)
                  }
                  type="button"
                >
                  <span className={ui.preferencesSearchResultTitle}>{result.title}</span>
                  <span className={ui.preferencesSearchResultPath}>{result.path}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <nav aria-label={translations.tabsLabel} className={ui.preferencesNavigation}>
            {(["mclip", "tools"] as const).map((group) => (
              <div className={ui.preferencesNavigationGroup} key={group}>
                <div className={ui.preferencesNavigationLabel}>
                  {group === "mclip"
                    ? translations.navigationGroupMclip
                    : translations.navigationGroupTools}
                </div>
                {destinations
                  .filter((destination) => destination.group === group)
                  .map((destination) => (
                    <button
                      aria-current={
                        destination.id === activeDestinationId ? "page" : undefined
                      }
                      className={ui.preferencesNavigationItem(
                        destination.id === activeDestinationId,
                      )}
                      key={destination.id}
                      onClick={() => onDestinationChange(destination.id)}
                      type="button"
                    >
                      {destination.title}
                    </button>
                  ))}
              </div>
            ))}
          </nav>
        )}
      </aside>
      <main className={ui.preferencesContent}>{children}</main>
    </div>
  );
}
