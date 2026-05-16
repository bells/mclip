export type AppSettings = {
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
