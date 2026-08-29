import type { TextTransformAction } from "../types";

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
