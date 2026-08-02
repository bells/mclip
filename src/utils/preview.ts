import type { HistoryListItem } from "../types";

const GROUP_PREVIEW_BASE_HEIGHT = 48;
const GROUP_PREVIEW_TEXT_ROW_HEIGHT = 32;
const GROUP_PREVIEW_IMAGE_ROW_HEIGHT = 64;
const PREVIEW_HEIGHT_CHANGE_TOLERANCE = 1;
const ITEM_PREVIEW_BASE_HEIGHT = 62;
const ITEM_PREVIEW_META_HEIGHT = 94;
const ITEM_PREVIEW_BODY_MIN_HEIGHT = 48;
const ITEM_PREVIEW_BODY_MAX_HEIGHT = 120;
const ITEM_PREVIEW_TEXT_CHARS_PER_LINE = 32;
const ITEM_PREVIEW_TEXT_LINE_HEIGHT = 21;
const ITEM_PREVIEW_CONTENT_ANCHOR_OFFSET = 46;

export function getGroupPreviewHeight(items: HistoryListItem[]) {
  return items.reduce(
    (height, item) =>
      height +
      (item.kind === "image"
        ? GROUP_PREVIEW_IMAGE_ROW_HEIGHT
        : GROUP_PREVIEW_TEXT_ROW_HEIGHT),
    GROUP_PREVIEW_BASE_HEIGHT,
  );
}

export function getGroupPreviewNaturalHeight(
  headerHeight: number,
  listScrollHeight: number,
  borderHeight = 0,
) {
  return normalizeMeasuredPreviewHeight(
    headerHeight + listScrollHeight + borderHeight,
  );
}

export function normalizeMeasuredPreviewHeight(height: number) {
  if (!Number.isFinite(height) || height <= 0) {
    return null;
  }

  return Math.ceil(height);
}

export function shouldApplyMeasuredPreviewHeight(
  currentHeight: number | null,
  nextHeight: number,
) {
  return (
    currentHeight === null ||
    Math.abs(currentHeight - nextHeight) > PREVIEW_HEIGHT_CHANGE_TOLERANCE
  );
}

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

export function getItemPreviewAnchorTop(rowTop: number) {
  // Align the detail content region with the hovered history row, not the
  // whole detail panel title.
  return rowTop - ITEM_PREVIEW_CONTENT_ANCHOR_OFFSET;
}
