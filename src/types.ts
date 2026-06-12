// 前后端共享的数据结构。字段命名需要和 Rust serde 的 camelCase 输出保持一致。

export type AppLanguage = "zhCn" | "en";
export type HistoryKind = "text" | "image" | "files";

export type EnabledHistoryTypes = Record<HistoryKind, boolean>;

export type AppSettings = {
  autoPaste: boolean;
  enabledHistoryTypes: EnabledHistoryTypes;
  language: AppLanguage;
  launchAtLogin: boolean;
  maxHistoryCount: number;
};

export type HistoryEntryBase = {
  copyCount: number;
  displayText: string;
  firstCopiedAt: number;
  id: string;
  lastCopiedAt: number;
  sourceApp: string | null;
};

export type TextHistoryEntry = HistoryEntryBase & {
  kind: "text";
  text: string;
};

export type ImageHistoryEntry = HistoryEntryBase & {
  kind: "image";
  imagePath: string;
  width: number;
  height: number;
  byteSize: number;
  contentHash: string;
};

export type FilesHistoryEntry = HistoryEntryBase & {
  kind: "files";
  filePaths: string[];
};

export type HistoryEntry =
  | TextHistoryEntry
  | ImageHistoryEntry
  | FilesHistoryEntry;

export type HistoryListItem = HistoryEntry & {
  renderId: string;
  position: number;
};

export type HistoryGroupInfo = {
  endPosition: number;
  index: number;
  label: string;
  startPosition: number;
};

export type HistoryGroupPreviewPayload = {
  autoPaste: boolean;
  kind: "group";
  group: HistoryGroupInfo;
  items: HistoryListItem[];
  language: AppLanguage;
};

export type HistoryItemPreviewPayload = {
  autoPaste: boolean;
  kind: "item";
  item: HistoryListItem;
  language: AppLanguage;
};

export type HistoryPreviewPayload =
  | HistoryGroupPreviewPayload
  | HistoryItemPreviewPayload;

export type HistoryPreviewKeyboardNavigationPayload =
  | {
      groupIndex: number;
      kind: "activate-first-group-item";
    }
  | {
      groupIndex: number;
      kind: "move-group-item";
      offset: -1 | 1;
    }
  | {
      groupIndex: number;
      kind: "clear-group-item";
    }
  | {
      groupIndex: number;
      kind: "select-group-item";
    };

export type HistoryPreviewGroupItemActivatedPayload = {
  groupIndex: number;
};
