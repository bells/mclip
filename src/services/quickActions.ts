import type {
  AppearanceTheme,
  AppLanguage,
  TextHistoryEntry,
  TextTransformAction,
} from "../types";
import { ensureAuxiliaryWindowReady } from "./auxiliaryWindows";
import { showQuickActionWindow, transformText } from "./ipc/commands";
import { updateQuickActionWindow } from "./ipc/events";

export async function openTextQuickAction(input: {
  action: TextTransformAction;
  appearanceTheme: AppearanceTheme;
  item: TextHistoryEntry;
  language: AppLanguage;
}, isCurrent: () => boolean = () => true) {
  const result = await transformText({
    action: input.action,
    input: input.item.text,
  });
  if (!isCurrent()) {
    return false;
  }
  await ensureAuxiliaryWindowReady("quick-action");
  if (!isCurrent()) {
    return false;
  }
  await updateQuickActionWindow({
    ...result,
    appearanceTheme: input.appearanceTheme,
    language: input.language,
    targetId: input.item.id,
  });
  if (!isCurrent()) {
    return false;
  }
  await showQuickActionWindow();
  return true;
}
