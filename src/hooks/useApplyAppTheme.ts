import { useEffect, useState } from "react";

import { listenToSettingsUpdated } from "../services/ipc/events";
import type { AppearanceTheme } from "../types";
import { resolveAppTheme } from "../utils/theme";

const SYSTEM_DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function useApplyAppTheme(appearanceTheme: AppearanceTheme) {
  const [currentTheme, setCurrentTheme] = useState(appearanceTheme);
  useEffect(() => setCurrentTheme(appearanceTheme), [appearanceTheme]);
  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenToSettingsUpdated((settings) => setCurrentTheme(settings.appearanceTheme))
      .then((unsubscribe) => {
        if (active) unlisten = unsubscribe;
        else unsubscribe();
      });
    return () => { active = false; unlisten?.(); };
  }, []);
  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY);

    const applyTheme = () => {
      const resolvedTheme = resolveAppTheme(currentTheme, mediaQuery.matches);

      document.documentElement.dataset.appTheme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);

    return () => {
      mediaQuery.removeEventListener("change", applyTheme);
    };
  }, [currentTheme]);
}
