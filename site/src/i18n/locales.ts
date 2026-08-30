export const SITE_LOCALES = {
  zh: {
    htmlLang: "zh-CN",
    label: "中文",
    ogLocale: "zh_CN",
  },
  en: {
    htmlLang: "en",
    label: "English",
    ogLocale: "en_US",
  },
  ja: {
    htmlLang: "ja",
    label: "日本語",
    ogLocale: "ja_JP",
  },
} as const;

export type SiteLocale = keyof typeof SITE_LOCALES;

export const SITE_LOCALE_LIST = ["zh", "en", "ja"] as const satisfies readonly SiteLocale[];

function localizedSuffix(path: string) {
  const suffix = path.replace(/^\/(?:zh|en|ja)(?=\/)/, "");
  return suffix.startsWith("/") ? suffix : `/${suffix}`;
}

export function localizedPath(locale: SiteLocale, currentPath: string) {
  return `/${locale}${localizedSuffix(currentPath)}`;
}

export function localizedPaths(currentPath: string) {
  return Object.fromEntries(
    SITE_LOCALE_LIST.map((locale) => [locale, localizedPath(locale, currentPath)]),
  ) as Record<SiteLocale, string>;
}
