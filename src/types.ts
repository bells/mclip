// 前后端共享的数据结构。字段命名需要和 Rust serde 的 camelCase 输出保持一致。

export type ResolvedAppLanguage = "zhCn" | "en";
export type AppLanguage = "system" | ResolvedAppLanguage;
export type HistoryKind = "text" | "image" | "files";
export type MenuBarIconStyle = "appIcon" | "light" | "m";
export type AppearanceTheme = "system" | "light" | "dark";
export type PerformanceClock = "rust" | "frontend";
export type PerformanceMilestoneName =
  | "processEntry"
  | "setupStart"
  | "trayReady"
  | "bootstrapReady"
  | "routeReady"
  | "listenersReady"
  | "historyReady"
  | "mainShowRequest"
  | "mainNativeVisible"
  | "mainPainted"
  | "previewRequest"
  | "previewNativeVisible"
  | "previewPainted"
  | "viewerRequest"
  | "viewerNativeVisible"
  | "viewerPainted"
  | "imageCacheHit"
  | "imageCacheMiss"
  | "imageReady"
  | "imageError";
export type PerformanceWindowLabel =
  | "main"
  | "preview"
  | "preview-detail"
  | "image-viewer"
  | "about"
  | "preferences";
export type PerformanceOutcome = "success" | "failure";
export type PerformanceAutomationAction = "openViewer" | "closeViewer";
export type AuxiliaryWindowLabel =
  | "preview"
  | "preview-detail"
  | "image-viewer"
  | "about"
  | "preferences";

export type PerformanceMilestone = {
  clock: PerformanceClock;
  elapsedMs: number;
  fixtureSize: number | null;
  interactionId: string | null;
  milestone: PerformanceMilestoneName;
  outcome: PerformanceOutcome;
  windowLabel: PerformanceWindowLabel | null;
};

export type EnabledHistoryTypes = Record<HistoryKind, boolean>;
export type CliInstallState =
  | "notInstalled"
  | "current"
  | "outdated"
  | "newer"
  | "unknown";

export type AppSettings = {
  autoPaste: boolean;
  enabledHistoryTypes: EnabledHistoryTypes;
  language: AppLanguage;
  launchAtLogin: boolean;
  maxHistoryCount: number;
  menuBarIconStyle: MenuBarIconStyle;
  mainWindowItemCount: number;
  historyGroupItemCount: number;
  showHistoryItemNumbers: boolean;
  showMainWindowBrand: boolean;
  appearanceTheme: AppearanceTheme;
};

export type CliInstallStatus = {
  executableName: string;
  installCommand: string;
  installDir: string;
  installPath: string;
  installedVersion: string | null;
  isInstalled: boolean;
  isOnPath: boolean;
  platformSupported: boolean;
  state: CliInstallState;
  targetVersion: string;
};

export type AutoPastePermissionStatus = {
  appPath: string | null;
  isGranted: boolean;
  requiresPermission: boolean;
  settingsUrl: string | null;
};

export type ImageCacheStats = {
  hits: number;
  misses: number;
  peakEncodedBytes: number;
  retainedEncodedBytes: number;
};

export type HistoryEntryBase = {
  copyCount: number;
  displayText: string;
  firstCopiedAt: number;
  id: string;
  lastCopiedAt: number;
  sourceApp: string | null;
  isPinned: boolean;
  pinnedAt: number | null;
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

export type HistorySnapshot = {
  entries: HistoryEntry[];
  revision: number;
};

export type HistoryCommandError = {
  code: "pinnedHistoryLimitReached" | "historyMutationFailed";
  message: string;
};

type RevisionedHistoryChange = {
  baseRevision: number;
  revision: number;
};

export type HistoryChange =
  | (RevisionedHistoryChange & {
      entries: HistoryEntry[];
      kind: "replace";
    })
  | (RevisionedHistoryChange & {
      entry: HistoryEntry;
      kind: "upsert";
      removedIds: string[];
    })
  | (RevisionedHistoryChange & {
      kind: "remove";
      removedIds: string[];
    })
  | (RevisionedHistoryChange & {
      kind: "clear";
    });

export type HistoryPreviewInvalidation =
  | (RevisionedHistoryChange & {
      closeCurrentPreview: true;
      kind: "replace" | "clear";
    })
  | (RevisionedHistoryChange & {
      closeCurrentPreview: boolean;
      kind: "remove";
      removedIds: string[];
    })
  | (RevisionedHistoryChange & {
      closeCurrentPreview: boolean;
      entry: HistoryEntry;
      kind: "upsert";
      removedIds: string[];
    });

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
  appearanceTheme: AppearanceTheme;
  kind: "group";
  group: HistoryGroupInfo;
  historyRevision: number;
  items: HistoryListItem[];
  language: AppLanguage;
  performanceInteractionId: string | null;
  showHistoryItemNumbers: boolean;
};

export type HistoryItemPreviewPayload = {
  autoPaste: boolean;
  appearanceTheme: AppearanceTheme;
  historyRevision: number;
  kind: "item";
  item: HistoryListItem;
  language: AppLanguage;
  performanceInteractionId: string | null;
};

export type ImageViewerPayload = {
  appearanceTheme: AppearanceTheme;
  item: Extract<HistoryListItem, { kind: "image" }>;
  language: AppLanguage;
  performanceInteractionId: string | null;
};

export type PerformanceInteraction = {
  interactionId: string;
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

export type HistoryPreviewMeasuredPayload = {
  groupIndex: number;
  height: number;
};
