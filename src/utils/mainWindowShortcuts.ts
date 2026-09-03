export type MainWindowShortcutAction =
  | "clearHistory"
  | "preferences"
  | "quit";

type MainWindowShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export type MainWindowShortcutPlatform = "macos" | "other";

export function getMainWindowShortcutPlatform(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
): MainWindowShortcutPlatform {
  return /Macintosh|Mac OS X/i.test(userAgent) ? "macos" : "other";
}

export function getMainWindowShortcutKeys(
  action: MainWindowShortcutAction,
  platform = getMainWindowShortcutPlatform(),
) {
  if (platform === "macos") {
    switch (action) {
      case "clearHistory":
        return ["⌥", "⌘", "⌫"];
      case "preferences":
        return ["⌘", ","];
      case "quit":
        return ["⌘", "Q"];
    }
  }

  switch (action) {
    case "clearHistory":
      return ["Ctrl", "Alt", "⌫"];
    case "preferences":
      return ["Ctrl", ","];
    case "quit":
      return ["Ctrl", "Q"];
  }
}

export function getMainWindowShortcutAriaKeys(
  action: MainWindowShortcutAction,
  platform = getMainWindowShortcutPlatform(),
) {
  const primaryModifier = platform === "macos" ? "Meta" : "Control";

  switch (action) {
    case "clearHistory":
      return `${primaryModifier}+Alt+Backspace`;
    case "preferences":
      return `${primaryModifier}+,`;
    case "quit":
      return `${primaryModifier}+Q`;
  }
}

export function getMainWindowShortcutAction(
  event: MainWindowShortcutEvent,
  platform = getMainWindowShortcutPlatform(),
): MainWindowShortcutAction | null {
  const normalizedKey = event.key.toLowerCase();
  const hasPrimaryModifier =
    platform === "macos"
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;

  if (!hasPrimaryModifier || event.shiftKey) {
    return null;
  }

  if (event.altKey && event.key === "Backspace") {
    return "clearHistory";
  }

  if (event.altKey) {
    return null;
  }

  if (event.key === ",") {
    return "preferences";
  }

  return normalizedKey === "q" ? "quit" : null;
}
