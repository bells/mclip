import { useEffect } from "react";

import type { AppearanceTheme } from "../types";
import { resolveAppTheme } from "../utils/theme";

const SYSTEM_DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function useApplyAppTheme(appearanceTheme: AppearanceTheme) {
  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY);

    const applyTheme = () => {
      const resolvedTheme = resolveAppTheme(appearanceTheme, mediaQuery.matches);

      document.documentElement.dataset.appTheme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);

    return () => {
      mediaQuery.removeEventListener("change", applyTheme);
    };
  }, [appearanceTheme]);
}
