import type { AppLanguage, ResolvedAppLanguage } from "../types";

export function resolveSupportedLanguage(locale: string | null | undefined): ResolvedAppLanguage {
  const normalizedLocale = locale?.toLowerCase() ?? "";

  if (normalizedLocale.startsWith("zh")) {
    return "zhCn";
  }

  if (normalizedLocale.startsWith("ja")) {
    return "ja";
  }

  return "en";
}

export function getSystemAppLanguage(): ResolvedAppLanguage {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const preferredLanguage =
    navigator.languages?.find((language) => language.trim() !== "") ??
    navigator.language;

  return resolveSupportedLanguage(preferredLanguage);
}

export function resolveAppLanguage(language: AppLanguage): ResolvedAppLanguage {
  if (language === "system") {
    return getSystemAppLanguage();
  }

  return language;
}

const DISPLAY_LOCALES: Record<ResolvedAppLanguage, string> = {
  zhCn: "zh-CN",
  en: "en-US",
  ja: "ja-JP",
};

export function getDisplayLocale(language: AppLanguage): string {
  return DISPLAY_LOCALES[resolveAppLanguage(language)];
}
