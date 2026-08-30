import type { TextQuickActionSettings, TextTransformAction } from "../types";

export const MAX_TEXT_TRANSFORM_INPUT_BYTES = 1024 * 1024;
export const MAX_TEXT_TRANSFORM_OUTPUT_BYTES = 4 * 1024 * 1024;
export const QUICK_ACTION_WINDOW_SIZE = { height: 420, width: 560 } as const;

export const TEXT_TRANSFORM_ACTIONS: readonly TextTransformAction[] = [
  "jsonPrettify",
  "jsonMinify",
  "base64Encode",
  "base64Decode",
  "urlComponentEncode",
  "urlComponentDecode",
];

export function isCurrentQuickActionRequest(
  currentItemId: string,
  requestItemId: string,
  currentRevision: number,
  requestRevision: number,
) {
  return currentItemId === requestItemId && currentRevision === requestRevision;
}

export type TextQuickActionGroup = keyof TextQuickActionSettings;

export const TEXT_QUICK_ACTION_GROUP_BY_ACTION = {
  jsonPrettify: "json",
  jsonMinify: "json",
  base64Encode: "base64",
  base64Decode: "base64",
  urlComponentEncode: "urlComponent",
  urlComponentDecode: "urlComponent",
} as const satisfies Record<TextTransformAction, TextQuickActionGroup>;

export function hasEnabledTextQuickActions(
  settings: TextQuickActionSettings,
): boolean {
  return settings.json || settings.base64 || settings.urlComponent;
}

export function filterEnabledTextQuickActions(
  actions: readonly TextTransformAction[],
  settings: TextQuickActionSettings,
): TextTransformAction[] {
  return actions.filter((action) => settings[TEXT_QUICK_ACTION_GROUP_BY_ACTION[action]]);
}
