// Static, compile-time checked desktop translation catalogs.

import type { AppLanguage, ResolvedAppLanguage } from "./types";
import { enTranslations, type AppTranslations } from "./i18n/en";
import { jaTranslations } from "./i18n/ja";
import { zhCnTranslations } from "./i18n/zhCn";
import { resolveAppLanguage } from "./utils/language";

export const translations: Record<ResolvedAppLanguage, AppTranslations> = {
  zhCn: zhCnTranslations,
  en: enTranslations,
  ja: jaTranslations,
};

export type { AppTranslations } from "./i18n/en";

export function getTranslations(language: AppLanguage): AppTranslations {
  // Defend against legacy or unsafe runtime input after the typed settings boundary.
  return translations[resolveAppLanguage(language)] ?? enTranslations;
}
