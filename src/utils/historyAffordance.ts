export type HistoryTextAffordance =
  | {
      color: string;
      kind: "color";
    }
  | {
      emoji: string;
      kind: "emoji";
    };

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR_PATTERN =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;
const EMOJI_TEXT_PATTERN =
  /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\u200d\ufe0f\s]+$/u;
const HAS_EMOJI_PATTERN = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u;

function isRgbChannel(value: string) {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 255;
}

function isValidRgbColor(value: string) {
  const match = value.match(RGB_COLOR_PATTERN);

  if (!match) {
    return false;
  }

  return [match[1], match[2], match[3]].every(
    (channel): channel is string => Boolean(channel) && isRgbChannel(channel),
  );
}

function isColorCode(value: string) {
  return HEX_COLOR_PATTERN.test(value) || isValidRgbColor(value);
}

function isShortEmojiText(value: string) {
  return (
    value.length <= 16 &&
    HAS_EMOJI_PATTERN.test(value) &&
    EMOJI_TEXT_PATTERN.test(value)
  );
}

export function getTextHistoryAffordance(
  text: string,
): HistoryTextAffordance | null {
  const normalizedText = text.trim();

  if (normalizedText.length === 0) {
    return null;
  }

  if (isColorCode(normalizedText)) {
    return {
      color: normalizedText,
      kind: "color",
    };
  }

  if (isShortEmojiText(normalizedText)) {
    return {
      emoji: normalizedText,
      kind: "emoji",
    };
  }

  return null;
}
