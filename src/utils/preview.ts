import type { HistoryListItem } from "../types";

const ITEM_PREVIEW_BASE_HEIGHT = 82;
const ITEM_PREVIEW_META_HEIGHT = 90;
const ITEM_PREVIEW_BODY_MIN_HEIGHT = 48;
const ITEM_PREVIEW_BODY_MAX_HEIGHT = 120;
const ITEM_PREVIEW_TEXT_CHARS_PER_LINE = 32;
const ITEM_PREVIEW_TEXT_LINE_HEIGHT = 21;

export function getItemPreviewHeight(item: HistoryListItem) {
  const bodyHeight = (() => {
    if (item.kind === "image") {
      return ITEM_PREVIEW_BODY_MAX_HEIGHT;
    }

    if (item.kind === "files") {
      return Math.min(
        ITEM_PREVIEW_BODY_MAX_HEIGHT,
        Math.max(ITEM_PREVIEW_BODY_MIN_HEIGHT, item.filePaths.length * 34),
      );
    }

    const lineCount = Math.ceil(item.text.length / ITEM_PREVIEW_TEXT_CHARS_PER_LINE);
    return Math.min(
      ITEM_PREVIEW_BODY_MAX_HEIGHT,
      Math.max(ITEM_PREVIEW_BODY_MIN_HEIGHT, lineCount * ITEM_PREVIEW_TEXT_LINE_HEIGHT),
    );
  })();

  return ITEM_PREVIEW_BASE_HEIGHT + bodyHeight + ITEM_PREVIEW_META_HEIGHT;
}
