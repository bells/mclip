import type { AppearanceTheme } from "../types";

export type ResolvedAppTheme = "light" | "dark";

export function resolveAppTheme(
  appearanceTheme: AppearanceTheme,
  prefersDark: boolean,
): ResolvedAppTheme {
  if (appearanceTheme === "light" || appearanceTheme === "dark") {
    return appearanceTheme;
  }

  return prefersDark ? "dark" : "light";
}
