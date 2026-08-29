import type {
  HistoryEntry,
  HistoryListItem,
  SensitiveHistoryRevealErrorCode,
  TextHistoryEntry,
} from "../types";

export const SENSITIVE_CONTENT_MASK = "••••••••";

export function isSensitiveTextEntry(
  entry: HistoryEntry,
): entry is TextHistoryEntry {
  return entry.kind === "text" && entry.secretType !== null;
}

export function maskSensitiveHistoryEntry<T extends HistoryEntry>(
  entry: T,
  maskingEnabled: boolean,
): T {
  if (!maskingEnabled || !isSensitiveTextEntry(entry)) {
    return entry;
  }

  return {
    ...entry,
    displayText: SENSITIVE_CONTENT_MASK,
    text: SENSITIVE_CONTENT_MASK,
  };
}

export function maskSensitiveHistoryItems(
  entries: HistoryListItem[],
  maskingEnabled: boolean,
): HistoryListItem[] {
  return entries.map((entry) =>
    maskSensitiveHistoryEntry(entry, maskingEnabled),
  );
}

export function isSensitiveTextMasked(entry: HistoryEntry): boolean {
  return (
    isSensitiveTextEntry(entry) && entry.text === SENSITIVE_CONTENT_MASK
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSensitiveRevealErrorCode(
  value: string,
): value is SensitiveHistoryRevealErrorCode {
  return (
    value === "itemNotFound" ||
    value === "classificationStale" ||
    value === "historyUnavailable"
  );
}

function parseSensitiveRevealErrorCode(
  value: unknown,
): SensitiveHistoryRevealErrorCode | null {
  if (typeof value === "string" && isSensitiveRevealErrorCode(value)) {
    return value;
  }

  if (isRecord(value) && typeof value.code === "string") {
    return parseSensitiveRevealErrorCode(value.code);
  }

  if (value instanceof Error) {
    return parseSensitiveRevealErrorCode(value.message);
  }

  if (typeof value === "string") {
    try {
      return parseSensitiveRevealErrorCode(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }

  return null;
}

export class SensitiveHistoryRevealCommandError extends Error {
  readonly code: SensitiveHistoryRevealErrorCode;

  constructor(code: SensitiveHistoryRevealErrorCode) {
    super(code);
    this.name = "SensitiveHistoryRevealCommandError";
    this.code = code;
  }
}

export function normalizeSensitiveHistoryRevealError(
  error: unknown,
): SensitiveHistoryRevealCommandError {
  if (error instanceof SensitiveHistoryRevealCommandError) {
    return error;
  }

  return new SensitiveHistoryRevealCommandError(
    parseSensitiveRevealErrorCode(error) ?? "historyUnavailable",
  );
}
