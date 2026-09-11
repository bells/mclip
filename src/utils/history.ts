// 纯前端历史列表工具：负责搜索过滤、分组计算和分页取数。

import type { HistoryEntry, HistoryGroupInfo, HistoryListItem } from "../types";

const FILE_LIST_DISPLAY_MAX_LENGTH = 29;
const FILE_LIST_DISPLAY_PREFIX_LENGTH = 14;

export function getHistoryItemSearchText(item: HistoryEntry): string {
  const commonText = `${item.displayText} ${item.sourceApp ?? ""}`;

  switch (item.kind) {
    case "text":
      return `${commonText} ${item.text}`;
    case "files":
      return `${commonText} ${item.filePaths.join(" ")}`;
    case "image":
      return `${commonText} image ${item.width}x${item.height}`;
  }
}

export function getHistoryListDisplayText(item: HistoryEntry): string {
  if (item.kind !== "files") {
    return item.displayText;
  }

  return getFileHistoryListDisplayText(item.filePaths);
}

function getFileHistoryListDisplayText(filePaths: string[]): string {
  const firstFilePath = filePaths[0];

  if (!firstFilePath) {
    return "Files";
  }

  const countSuffix = filePaths.length > 1 ? ` +${filePaths.length - 1}` : "";
  const availableLength = FILE_LIST_DISPLAY_MAX_LENGTH - countSuffix.length;

  return `${middleEllipsizeFileName(
    getFileName(firstFilePath),
    availableLength,
  )}${countSuffix}`;
}

function getFileName(filePath: string): string {
  const lastSeparatorIndex = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );

  return filePath.slice(lastSeparatorIndex + 1) || filePath;
}

function middleEllipsizeFileName(fileName: string, maxLength: number): string {
  if (fileName.length <= maxLength) {
    return fileName;
  }

  if (maxLength <= 3) {
    return fileName.slice(0, maxLength);
  }

  const startLength = Math.min(
    FILE_LIST_DISPLAY_PREFIX_LENGTH,
    Math.max(1, maxLength - 4),
  );
  const endLength = Math.max(1, maxLength - startLength - 3);

  return `${fileName.slice(0, startLength)}...${fileName.slice(
    fileName.length - endLength,
  )}`;
}

export function filterHistoryItems(
  history: HistoryEntry[],
  searchQuery: string,
): HistoryListItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matches: HistoryListItem[] = [];
  history.forEach((entry, index) => {
    if (normalizedQuery !== "" && !matchesSearchQuery(entry, normalizedQuery)) {
      return;
    }
    matches.push({
      ...entry,
      renderId: `${index}:${entry.id}:${entry.lastCopiedAt}`,
      position: index + 1,
    });
  });
  return matches;
}

function matchesSearchQuery(item: HistoryEntry, query: string): boolean {
  // Keep phrase matches across the spaces joining fields, without building the
  // combined string for single-field queries or retaining a second text index.
  if (query.includes(" ")) {
    return getHistoryItemSearchText(item).toLowerCase().includes(query);
  }
  if (item.displayText.toLowerCase().includes(query) || item.sourceApp?.toLowerCase().includes(query)) {
    return true;
  }
  switch (item.kind) {
    case "text":
      return item.text !== item.displayText && item.text.toLowerCase().includes(query);
    case "files":
      return item.filePaths.some((filePath) => filePath.toLowerCase().includes(query));
    case "image":
      return "image".includes(query) || `${item.width}x${item.height}`.includes(query);
  }
}

export function splitPinnedHistoryItems(items: HistoryListItem[]) {
  return {
    pinned: items.filter((item) => item.isPinned),
    unpinned: items.filter((item) => !item.isPinned),
  };
}

export function getVisibleHistoryItems(
  items: HistoryListItem[],
  mainWindowItemCount: number,
) {
  const { pinned, unpinned } = splitPinnedHistoryItems(items);
  return [...pinned, ...unpinned.slice(0, mainWindowItemCount).map((item, index) => ({
    ...item,
    position: index + 1,
  }))];
}

export function getHistoryGroups(
  itemCount: number,
  mainWindowItemCount: number,
  historyGroupItemCount: number,
): HistoryGroupInfo[] {
  if (itemCount <= 0) {
    return [];
  }

  const groups: HistoryGroupInfo[] = [
    {
      endPosition: mainWindowItemCount,
      index: 0,
      label: "1",
      startPosition: 1,
    },
  ];
  let startPosition = mainWindowItemCount + 1;

  while (startPosition <= itemCount) {
    const index = groups.length;

    // 分组范围按完整组显示，例如实际只有第 11 条，也显示 11-20。
    groups.push({
      endPosition: startPosition + historyGroupItemCount - 1,
      index,
      label: String(index + 1),
      startPosition,
    });
    startPosition += historyGroupItemCount;
  }

  return groups;
}

export function getHistoryGroupItems(
  items: HistoryListItem[],
  group: HistoryGroupInfo,
): HistoryListItem[] {
  const startIndex = Math.max(0, group.startPosition - 1);
  const unpinned = items.filter((item) => !item.isPinned);
  return unpinned.slice(startIndex, Math.min(unpinned.length, group.endPosition));
}
