// 前后端共享的数据结构。字段命名需要和 Rust serde 的 camelCase 输出保持一致。

export type AppLanguage = "zhCn" | "en";

export type AppSettings = {
  language: AppLanguage;
  launchAtLogin: boolean;
  maxHistoryCount: number;
};

export type HistoryListItem = {
  id: string;
  position: number;
  text: string;
};

export type HistoryGroupInfo = {
  endPosition: number;
  index: number;
  label: string;
  startPosition: number;
};

export type HistoryPreviewPayload = {
  group: HistoryGroupInfo;
  items: HistoryListItem[];
  language: AppLanguage;
};
