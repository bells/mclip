import type { AppTranslations } from "../../i18n";

type PreferencesTranslations = AppTranslations["preferences"];
type PreferenceStringKey = {
  [Key in keyof PreferencesTranslations]: PreferencesTranslations[Key] extends string
    ? Key
    : never;
}[keyof PreferencesTranslations];

export type PreferencesDestinationId =
  | "general"
  | "appearance"
  | "history"
  | "privacy"
  | "textActions"
  | "cli";

export type PreferencesNavigationGroup = "mclip" | "tools";

export type PreferencesDestination = {
  description: string;
  group: PreferencesNavigationGroup;
  id: PreferencesDestinationId;
  title: string;
};

export type PreferenceSettingDescriptor = {
  aliases: readonly string[];
  description: string;
  destinationId: PreferencesDestinationId;
  focusTargetId: string;
  id: string;
  path: string;
  title: string;
};

type TranslatePreference = (key: PreferenceStringKey) => string;

type DestinationDefinition = {
  descriptionKey: PreferenceStringKey;
  group: PreferencesNavigationGroup;
  id: PreferencesDestinationId;
  titleKey: PreferenceStringKey;
};

type SettingDefinition = {
  aliases?: readonly string[];
  descriptionKey: PreferenceStringKey;
  destinationId: PreferencesDestinationId;
  id: string;
  titleKey: PreferenceStringKey;
};

const DESTINATION_DEFINITIONS: readonly DestinationDefinition[] = [
  {
    id: "general",
    group: "mclip",
    titleKey: "generalTab",
    descriptionKey: "generalPageDescription",
  },
  {
    id: "appearance",
    group: "mclip",
    titleKey: "appearanceTab",
    descriptionKey: "appearancePageDescription",
  },
  {
    id: "history",
    group: "mclip",
    titleKey: "historyTab",
    descriptionKey: "historyPageDescription",
  },
  {
    id: "privacy",
    group: "mclip",
    titleKey: "privacyTab",
    descriptionKey: "privacyPageDescription",
  },
  {
    id: "textActions",
    group: "tools",
    titleKey: "textActionsTab",
    descriptionKey: "textActionsPageDescription",
  },
  {
    id: "cli",
    group: "tools",
    titleKey: "cliTab",
    descriptionKey: "cliPageDescription",
  },
];

const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  setting("general.language", "general", "languageLabel", "languageDescription", ["locale"]),
  setting("general.launch-at-login", "general", "launchAtLoginLabel", "launchAtLoginDescription", ["startup", "login"]),
  setting("general.auto-paste", "general", "autoPasteLabel", "autoPasteDescription", ["paste", "accessibility"]),
  setting("general.desktop-capabilities", "general", "desktopCapabilitiesGroupLabel", "desktopCapabilitiesDescription", ["linux", "wayland", "x11", "tray", "shortcut"]),
  setting("appearance.theme", "appearance", "appearanceThemeLabel", "appearanceThemeDescription", ["light", "dark", "system"]),
  setting("appearance.menu-bar-icon", "appearance", "menuBarIconStyleLabel", "menuBarIconStyleDescription", ["tray", "status bar"]),
  setting("appearance.brand", "appearance", "showMainWindowBrandLabel", "showMainWindowBrandDescription", ["logo", "brand"]),
  setting("appearance.item-numbers", "appearance", "showHistoryItemNumbersLabel", "showHistoryItemNumbersDescription", ["number", "index"]),
  setting("history.types", "history", "typesLabel", "typesDescription", ["text", "image", "files"]),
  setting("history.maximum", "history", "maxHistoryCountLabel", "maxHistoryCountDescription", ["limit", "retention"]),
  setting("history.main-count", "history", "mainWindowItemCountLabel", "mainWindowItemCountDescription", ["visible", "main"]),
  setting("history.group-count", "history", "historyGroupItemCountLabel", "historyGroupItemCountDescription", ["archive", "group"]),
  setting("privacy.masking", "privacy", "maskSensitiveContentLabel", "maskSensitiveContentDescription", ["secret", "mask"]),
  setting("privacy.reclassify", "privacy", "reclassifyLegacyAction", "reclassifyLegacyDescription", ["scan", "detector"]),
  setting("privacy.source-exclusion", "privacy", "sourceExclusionGroupLabel", "sourceExclusionDescription", ["ignore", "app"]),
  setting("text-actions.json", "textActions", "textActionJsonLabel", "textActionJsonDescription", ["json", "pretty", "minify"]),
  setting("text-actions.base64", "textActions", "textActionBase64Label", "textActionBase64Description", ["base64", "encode", "decode"]),
  setting("text-actions.url", "textActions", "textActionUrlLabel", "textActionUrlDescription", ["url", "percent", "encode", "decode"]),
  setting("cli.status", "cli", "cliSectionLabel", "cliSectionDescription", ["agent", "terminal", "codex"]),
];

export const PREFERENCE_SETTING_IDS = SETTING_DEFINITIONS.map(
  (definition) => definition.id,
);

export function createPreferencesDestinations(
  translate: TranslatePreference,
): PreferencesDestination[] {
  return DESTINATION_DEFINITIONS.map((definition) => ({
    id: definition.id,
    group: definition.group,
    title: translate(definition.titleKey),
    description: translate(definition.descriptionKey),
  }));
}

export function createPreferenceSettingIndex(
  destinations: readonly PreferencesDestination[],
  translate: TranslatePreference,
): PreferenceSettingDescriptor[] {
  return SETTING_DEFINITIONS.map((definition) => ({
    id: definition.id,
    destinationId: definition.destinationId,
    title: translate(definition.titleKey),
    description: translate(definition.descriptionKey),
    aliases: definition.aliases ?? [],
    path:
      destinations.find((destination) => destination.id === definition.destinationId)
        ?.title ?? definition.destinationId,
    focusTargetId: preferenceFocusTargetId(definition.id),
  }));
}

export function filterPreferenceSettings(
  settings: readonly PreferenceSettingDescriptor[],
  query: string,
): PreferenceSettingDescriptor[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  return settings.filter((settingDescriptor) =>
    [
      settingDescriptor.title,
      settingDescriptor.description,
      settingDescriptor.path,
      ...settingDescriptor.aliases,
    ].some((value) => normalizeSearchText(value).includes(normalizedQuery)),
  );
}

export function preferenceFocusTargetId(settingId: string): string {
  return `preference-setting-${settingId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function setting(
  id: string,
  destinationId: PreferencesDestinationId,
  titleKey: PreferenceStringKey,
  descriptionKey: PreferenceStringKey,
  aliases: readonly string[] = [],
): SettingDefinition {
  return { id, destinationId, titleKey, descriptionKey, aliases };
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}
