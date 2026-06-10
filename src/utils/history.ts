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

  return history
    .map((entry, index) => ({
      ...entry,
      renderId: `${index}:${entry.id}:${entry.lastCopiedAt}`,
      position: index + 1,
    }))
    .filter(
      (item) =>
        normalizedQuery === "" ||
        getHistoryItemSearchText(item).toLowerCase().includes(normalizedQuery),
    );
}

export function getHistoryGroups(
  itemCount: number,
  groupSize: number,
): HistoryGroupInfo[] {
  const groupCount = Math.ceil(itemCount / groupSize);

  return Array.from({ length: groupCount }, (_, index) => {
    const startPosition = index * groupSize + 1;
    const endPosition = (index + 1) * groupSize;

    // 分组范围按完整组显示，例如实际只有第 11 条，也显示 11-20。
    return {
      endPosition,
      index,
      label: String(index + 1),
      startPosition,
    };
  });
}

export function getHistoryGroupItems(
  items: HistoryListItem[],
  groupIndex: number,
  groupSize: number,
): HistoryListItem[] {
  const startIndex = groupIndex * groupSize;
  return items.slice(startIndex, startIndex + groupSize);
}
