type WindowControlSide = "left" | "right";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mclip-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mclip-surface)]";
const compactButton =
  "inline-flex min-h-8 items-center justify-center rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line-strong)] bg-[var(--mclip-control-bg)] px-3 text-[11px] font-semibold text-[var(--mclip-ink-soft)] transition-colors duration-150 hover:bg-[var(--mclip-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45";
const iconButton =
  "inline-flex size-7 items-center justify-center rounded-md text-[var(--mclip-ink-dim)] opacity-0 transition-colors transition-opacity duration-150";
const fieldSurface =
  "rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line)] bg-[var(--mclip-control-bg)]";
const settingsRow =
  "flex items-start justify-between gap-4 rounded-[var(--mclip-radius-md)] border border-[var(--mclip-line)] bg-[var(--mclip-control-bg)] px-3 py-2";
const settingsSelect =
  `${focusRing} h-8 w-full rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line-strong)] bg-[var(--mclip-surface)] px-2 text-[12px] font-medium text-[var(--mclip-ink)] outline-none`;
const previewSurface =
  "relative min-h-0 overflow-hidden rounded-[var(--mclip-radius-lg)] border border-[var(--mclip-line)] [background:var(--mclip-surface-bg)] text-[var(--mclip-ink)] shadow-[var(--mclip-soft-shadow)]";
const listText =
  "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-medium leading-5 text-[var(--mclip-ink-soft)]";

export const ui = {
  focusRing,
  appFrame:
    "h-screen w-screen overflow-hidden rounded-[var(--mclip-radius-lg)] [clip-path:inset(0_round_var(--mclip-radius-lg))]",
  appPanel:
    "relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[var(--mclip-radius-lg)] border border-[var(--mclip-line)] [background:var(--mclip-panel-bg)] text-[var(--mclip-ink)] shadow-[var(--mclip-shadow)]",
  appBody: "relative z-[1] shrink-0 overflow-hidden px-[7px] py-1",
  mainScrollRegion:
    "mclip-scrollbar relative z-[1] min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain",
  mainScrollContent: "grid content-start",
  mainHeaderMeasure: "shrink-0",
  mainFooterMeasure: "shrink-0",

  header:
    "relative z-[1] flex shrink-0 items-center gap-2 border-b border-[var(--mclip-line)] px-2.5 pb-2 pt-2.5",
  brand: "flex min-w-0 items-center gap-1.5",
  brandHidden: "hidden",
  brandIcon:
    "size-[22px] shrink-0 rounded-md border border-[var(--mclip-line)] object-cover shadow-sm",
  kicker:
    "max-w-[64px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold text-[var(--mclip-ink)]",
  searchShell: "relative min-w-0 flex-1",
  searchIcon:
    "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--mclip-ink-dim)]",
  search:
    `h-[30px] w-full rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line)] bg-[var(--mclip-control-bg)] px-3 pl-8 text-[12px] font-medium text-[var(--mclip-ink)] outline-none transition-colors duration-150 placeholder:text-[var(--mclip-placeholder)] focus:border-[var(--mclip-accent-cool)] focus:bg-[var(--mclip-surface)] focus:shadow-[0_0_0_3px_rgba(115,208,200,0.16)] ${focusRing}`,

  historyGroup: "overflow-visible",
  empty:
    "mx-0 my-1 rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line)] bg-[var(--mclip-surface-translucent)] px-3 py-4 text-center text-[12px] font-medium leading-5 text-[var(--mclip-ink-soft)]",
  itemIndex:
    "w-[26px] shrink-0 text-right text-[11px] font-semibold tabular-nums text-[var(--mclip-index)]",
  itemText: listText,
  historyTextWithAffordance: "flex min-w-0 items-center gap-2",
  historyDisplayText: "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
  historyAffordance: "inline-flex size-5 shrink-0 items-center justify-center",
  historyColorSwatch:
    "size-[15px] rounded-[5px] border border-[var(--mclip-line-strong)] shadow-sm",
  historyEmojiBadge:
    "inline-flex size-5 items-center justify-center rounded-md bg-[var(--mclip-control-bg)] text-[13px] leading-none",
  itemThumbnailWrap: "flex min-w-0 items-center gap-2",
  itemThumbnail:
    "size-[26px] shrink-0 rounded-md border border-[var(--mclip-line)] object-cover",
  deleteIcon: "size-3.5",

  archive: "px-[7px] pb-[6px] pt-0",
  archiveDivider: "mx-1 mb-1 h-px bg-[var(--mclip-line)]",
  archiveList:
    "mclip-scrollbar grid max-h-[186px] content-start gap-1 overflow-y-auto overflow-x-hidden pr-1 overscroll-contain",
  archiveEntry: "min-w-0",
  archiveFolderIcon: "size-3.5 shrink-0 text-[var(--mclip-index)]",
  archiveLabel: "min-w-0 flex-1 text-left text-[12px] font-medium text-[var(--mclip-ink-soft)]",
  archiveChevron: "size-3.5 shrink-0 text-[var(--mclip-ink-dim)]",

  footer:
    "relative z-[1] grid shrink-0 grid-cols-1 gap-[3px] border-t border-[var(--mclip-line)] bg-[var(--mclip-control-bg)] px-[6px] pb-[10px] pt-[5px]",
  menuAction: "flex min-w-0 items-center gap-2",
  menuIcon: "size-3.5 shrink-0 text-[var(--mclip-ink-dim)] transition-colors duration-150",
  menuLabel:
    "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-[var(--mclip-ink-soft)]",
  menuHint:
    "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-[11px] font-semibold leading-[1.25] tabular-nums text-[var(--mclip-ink-dim)]",

  modalOverlay:
    "fixed inset-0 z-30 flex items-center justify-center bg-black/55 p-4",
  modal:
    "w-full max-w-[260px] overflow-hidden rounded-[var(--mclip-radius-md)] border border-[var(--mclip-line)] [background:var(--mclip-surface-bg)] text-[var(--mclip-ink)] shadow-[var(--mclip-soft-shadow)]",
  modalHeader: "border-b border-[var(--mclip-line)] px-4 py-3",
  modalTitle: "text-[13px] font-semibold text-[var(--mclip-ink)]",
  modalContent: "px-4 py-4 text-[12px] leading-5 text-[var(--mclip-ink-soft)]",
  modalFooter: "flex justify-end gap-2 border-t border-[var(--mclip-line)] px-4 py-3",
  clearConfirmModal: "max-w-[280px]",
  clearConfirm: "flex items-start gap-3",
  clearConfirmMark:
    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--mclip-danger)] text-[var(--mclip-danger)]",
  clearConfirmMessage: "m-0 text-[12px] leading-5 text-[var(--mclip-ink-dim)]",
  modalButton:
    `min-h-8 rounded-[var(--mclip-radius-sm)] px-3 text-[12px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`,
  modalPrimaryButton:
    "bg-[var(--mclip-accent-cool)] text-black hover:brightness-110",
  modalDangerButton:
    "bg-[var(--mclip-danger)] text-white hover:brightness-110",
  modalSecondaryButton:
    "bg-[var(--mclip-control-bg)] text-[var(--mclip-ink-soft)] hover:bg-[var(--mclip-control-bg-hover)]",

  errorPanel:
    "m-3 flex flex-col gap-2 rounded-[var(--mclip-radius-md)] border border-[var(--mclip-line)] bg-[var(--mclip-surface-translucent)] p-4",
  errorTitle: "text-[13px] font-semibold text-[var(--mclip-ink)]",
  errorCopy: "text-[12px] leading-5 text-[var(--mclip-ink-dim)]",

  previewWindow:
    "flex h-screen w-screen overflow-hidden rounded-[var(--mclip-radius-lg)] [clip-path:inset(0_round_var(--mclip-radius-lg))]",
  historyPreview: previewSurface,
  historyPreviewHeader:
    "flex shrink-0 items-center justify-between gap-3 border-b border-[var(--mclip-line)] px-3 py-2",
  historyPreviewKicker:
    "text-[10px] font-bold uppercase tracking-normal text-[var(--mclip-kicker)]",
  historyPreviewRange:
    "text-[12px] font-semibold tabular-nums text-[var(--mclip-ink)]",
  historyDetailPreview:
    "flex h-full min-h-0 w-full flex-col",
  historyDetailBody: "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]",
  historyDetailContentRegion:
    "mclip-scrollbar min-h-0 overflow-y-auto border-b border-[var(--mclip-line)] p-3",
  historyDetailContent:
    "whitespace-pre-wrap break-words rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line)] bg-[var(--mclip-control-bg)] p-3 text-[12px] leading-5 text-[var(--mclip-ink)] [overflow-wrap:anywhere]",
  historyDetailAffordance:
    "mb-2 inline-flex items-center justify-center text-[var(--mclip-ink-soft)]",
  historyDetailImageWrap:
    "flex min-h-0 flex-col items-center justify-center gap-2 rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line)] bg-[var(--mclip-surface-translucent)] p-2",
  historyDetailImage:
    "max-h-[180px] max-w-full rounded-md object-contain",
  historyDetailImageCaption:
    "max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--mclip-ink-soft)]",
  historyDetailFiles:
    "grid gap-2 rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line)] bg-[var(--mclip-surface-translucent)] p-2",
  historyDetailFile:
    "whitespace-normal break-words rounded-md border border-[var(--mclip-line)] bg-[var(--mclip-control-bg)] px-2 py-1.5 text-[11px] leading-4 text-[var(--mclip-ink-soft)] [overflow-wrap:anywhere]",
  historyDetailMeta:
    "grid shrink-0 gap-[5px] px-3 py-1.5 text-[11px]",
  historyDetailMetaItem:
    "grid min-w-0 grid-cols-[86px_minmax(0,1fr)] items-baseline gap-2.5",
  historyDetailMetaLabel:
    "m-0 text-[11px] font-semibold text-[var(--mclip-meta)]",
  historyDetailMetaValue:
    "m-0 min-w-0 whitespace-normal break-words text-[11px] font-semibold leading-4 text-[var(--mclip-ink-soft)] [overflow-wrap:anywhere]",
  historyGroupPreviewWindow:
    "grid h-screen w-screen overflow-hidden rounded-[var(--mclip-radius-lg)] [clip-path:inset(0_round_var(--mclip-radius-lg))]",
  historyGroupPreviewWindowWithDetail:
    "grid-cols-[minmax(0,320px)_minmax(0,304px)] gap-0",
  historyGroupPreviewWindowDetailLeft:
    "grid-cols-[minmax(0,304px)_minmax(0,320px)]",
  historyGroupDetailPane:
    "min-h-0 max-h-[calc(100vh-var(--detail-preview-offset,0px))] translate-y-[var(--detail-preview-offset,0)] overflow-hidden rounded-[var(--mclip-radius-lg)] [clip-path:inset(0_round_var(--mclip-radius-lg))]",
  historyGroupHoverDetail:
    "h-[min(var(--detail-preview-height),calc(100vh-var(--detail-preview-offset,0px)))] max-h-full",
  historyGroupPreview:
    "flex h-[var(--group-preview-height)] max-h-screen min-h-0 flex-col",
  historyGroupPreviewBody: "min-h-0 flex-1 overflow-hidden",
  historyPreviewList:
    "mclip-scrollbar grid max-h-full gap-0.5 overflow-y-auto overflow-x-hidden p-1.5",
  historyPreviewIndex:
    "w-[22px] shrink-0 text-right text-[11px] font-semibold tabular-nums text-[var(--mclip-index)]",
  historyPreviewText: listText,
  historyPreviewDetailWindow:
    "flex h-screen w-screen items-start overflow-hidden rounded-[var(--mclip-radius-lg)] [clip-path:inset(0_round_var(--mclip-radius-lg))]",

  dialogFrame:
    "h-screen w-screen overflow-hidden rounded-[var(--mclip-radius-lg)] [clip-path:inset(0_round_var(--mclip-radius-lg))] text-[var(--mclip-ink)]",
  dialogPanel:
    "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[var(--mclip-radius-lg)] border border-[var(--mclip-line)] [background:var(--mclip-surface-bg)] text-[var(--mclip-ink)] shadow-[var(--mclip-shadow)]",
  aboutWindowFrame: "h-screen w-screen",
  preferencesWindowFrame: "h-screen w-screen",
  dialogContent:
    "mclip-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 text-[12px] leading-5 text-[var(--mclip-ink-soft)]",
  dialogStatusBar: (controlSide: WindowControlSide) =>
    [
      "relative flex h-9 shrink-0 items-center gap-3 border-b border-[var(--mclip-titlebar-line)] bg-[var(--mclip-titlebar-bg)] px-3 text-[var(--mclip-titlebar-ink)]",
      controlSide === "left" ? "justify-start" : "justify-between",
      controlSide === "right" ? "flex-row-reverse" : "",
    ].filter(Boolean).join(" "),
  dialogCenteredTitle:
    "pointer-events-none absolute left-1/2 max-w-[calc(100%-120px)] -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-center",
  windowControls: "flex items-center gap-2",
  windowControl:
    `size-3 rounded-full border border-black/15 transition-transform duration-150 disabled:opacity-45 ${focusRing}`,
  windowControlClose: "bg-[#ff5f57] hover:brightness-110",
  windowControlMinimize: "bg-[#ffbd2e]",
  windowControlMaximize: "bg-[#28c840]",
  aboutIcon:
    "size-10 shrink-0 rounded-[10px] border border-[var(--mclip-line)] object-cover",
  modalIdentity: "grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1",
  modalAppName: "m-0 text-[18px] font-semibold leading-6 text-[var(--mclip-ink)]",
  modalVersion: "text-[11px] font-semibold text-[var(--mclip-meta)]",
  modalDescription: "m-0 text-[12px] leading-5 text-[var(--mclip-ink-dim)]",
  aboutLinks: "grid grid-cols-2 gap-2",
  aboutLinkButton: `${compactButton} justify-center`,
  aboutLinkLabel:
    "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--mclip-accent-cool)]",
  diagnosticsActions: "grid grid-cols-3 gap-2",
  updateActions: "grid grid-cols-2 gap-2",
  diagnosticsButton: compactButton,
  updateStatus: "min-h-4 text-[11px] font-semibold text-[var(--mclip-accent-cool)]",
  updateStatusError: "text-[var(--mclip-danger)]",
  diagnosticsStatus: "min-h-4 text-[11px] font-semibold text-[var(--mclip-accent-cool)]",

  settingsWindowPanel: "h-full",
  settingsContent: "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3",
  settingsTabs:
    "grid grid-cols-3 gap-1 rounded-[var(--mclip-radius-md)] border border-[var(--mclip-line)] bg-[var(--mclip-control-bg)] p-1",
  settingsTabPanel:
    "mclip-scrollbar grid min-h-0 content-start gap-3 overflow-y-auto pr-0.5",
  settingsPrimaryGrid: "grid grid-cols-3 gap-2",
  settingsCompactField: `${fieldSurface} grid gap-1.5 p-2`,
  settingsRow,
  settingsSwitchGroup: "grid gap-2",
  settingsSwitchActions: "flex flex-wrap items-center gap-2 pl-8",
  settingsSwitchRow:
    "grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-3 py-1.5 text-left",
  settingsSwitchRowDisabled: "opacity-65",
  settingsSwitchBox:
    `${focusRing} mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-[var(--mclip-line-strong)] bg-[var(--mclip-control-bg)] text-transparent transition-colors duration-150 hover:bg-[var(--mclip-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-60`,
  settingsSwitchBoxOn:
    "border-[#0a84ff] bg-[#0a84ff] text-white hover:bg-[#0a84ff]",
  settingsSection: `${fieldSurface} grid gap-2 p-3`,
  settingsSectionHeading: "grid gap-1",
  settingsGroupLabel: "text-[11px] font-semibold text-[var(--mclip-meta)]",
  settingsCopy: "grid min-w-0 gap-1",
  settingsRowActions: "flex shrink-0 flex-wrap items-center justify-end gap-2",
  settingsLabel: "text-[12px] font-semibold text-[var(--mclip-ink)]",
  settingsDescription: "text-[11px] leading-4 text-[var(--mclip-ink-dim)]",
  settingsNote: "text-[10px] leading-4 text-[var(--mclip-meta)]",
  settingsNoteOk: "text-[var(--mclip-accent-cool)]",
  settingsNoteWarning: "text-[var(--mclip-meta)]",
  settingsError:
    "rounded-[var(--mclip-radius-sm)] border border-[color-mix(in_srgb,var(--mclip-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--mclip-danger)_10%,transparent)] px-3 py-2 text-[11px] font-semibold text-[var(--mclip-danger)]",
  settingsStatus:
    "rounded-[var(--mclip-radius-sm)] border border-[color-mix(in_srgb,var(--mclip-accent-cool)_28%,transparent)] bg-[color-mix(in_srgb,var(--mclip-accent-cool)_9%,transparent)] px-3 py-2 text-[11px] font-semibold text-[var(--mclip-accent-cool)]",
  settingsSelect: settingsSelect,
  languageSelect: "",
  menuBarIconOptions: "grid grid-cols-3 gap-1",
  menuBarIconOption:
    `${focusRing} flex h-8 items-center justify-center rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line-strong)] transition-colors duration-150 hover:border-[var(--mclip-accent-cool)]`,
  menuBarIconOptionActive:
    "border-[var(--mclip-accent-cool)] shadow-[0_0_0_2px_rgba(115,208,200,0.16)]",
  menuBarIconOptionAppSurface: "bg-[var(--mclip-surface)]",
  menuBarIconOptionLightSurface: "bg-[#24261f]",
  menuBarIconOptionMSurface: "bg-[#f4f1e8]",
  menuBarIconOptionImage: "size-5 object-contain",
  stepper: "grid grid-cols-[32px_54px_32px] items-center gap-1",
  stepperButton: `${focusRing} flex h-8 items-center justify-center rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line-strong)] bg-[var(--mclip-control-bg)] text-[14px] font-semibold text-[var(--mclip-ink)] transition-colors duration-150 hover:bg-[var(--mclip-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45`,
  stepperInput:
    `${focusRing} h-8 rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line)] bg-[var(--mclip-surface)] px-1 text-center text-[12px] font-semibold tabular-nums text-[var(--mclip-ink)] outline-none`,
  historyTypeList:
    "overflow-hidden rounded-[var(--mclip-radius-md)] border border-[var(--mclip-line)]",
  historyTypeLabel: "text-[12px] font-semibold text-[var(--mclip-ink-soft)]",
  historyTypeCheck:
    "flex size-5 items-center justify-center rounded-full border border-[var(--mclip-line-strong)] text-[var(--mclip-accent-cool)]",
  cliInstallSection: "gap-3",
  cliStatusRow: "grid grid-cols-[1fr_auto] items-center gap-3",
  cliStatusCopy: "grid min-w-0 gap-1",
  cliStatusBadge:
    "w-fit rounded-full border border-[var(--mclip-line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--mclip-danger)]",
  cliStatusBadgeInstalled: "text-[var(--mclip-accent-cool)]",
  cliCommandRow: "grid grid-cols-[1fr_auto] items-center gap-2",
  cliCommand:
    "mclip-scrollbar overflow-x-auto whitespace-nowrap rounded-[var(--mclip-radius-sm)] border border-[var(--mclip-line-strong)] bg-[var(--mclip-surface)] px-2 py-1.5 text-[11px] text-[var(--mclip-ink)]",
  settingsActionButton: compactButton,
  cliActionButton: compactButton,
  cliCopyButton: compactButton,
};

export function appFrame(isKeyboardNavigating: boolean) {
  return [ui.appFrame, isKeyboardNavigating ? "is-keyboard-navigating" : ""]
    .filter(Boolean)
    .join(" ");
}

export function historyItemRow(isSelected: boolean, isKeyboardNavigating: boolean) {
  return [
    "relative grid min-h-8 w-full grid-cols-[minmax(0,1fr)_auto] items-center rounded-[var(--mclip-radius-sm)] transition-colors transition-shadow duration-150",
    isKeyboardNavigating ? "" : "group",
    isSelected
      ? "[background:var(--mclip-selected-bg)] shadow-[inset_0_0_0_1px_var(--mclip-selection-strong)]"
      : isKeyboardNavigating
        ? "hover:bg-transparent hover:shadow-none"
        : "hover:bg-[var(--mclip-row-hover-bg)]",
  ].join(" ");
}

export function historyItem(showItemNumbers: boolean) {
  return [
    "grid min-h-8 w-full min-w-0 items-center gap-2 rounded-[var(--mclip-radius-sm)] px-2 py-1 text-left",
    showItemNumbers ? "grid-cols-[26px_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)]",
    focusRing,
  ].join(" ");
}

export function historyDeleteButton(isVisible: boolean) {
  return [
    iconButton,
    isVisible
      ? "pointer-events-auto opacity-100"
      : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100",
    "hover:text-[var(--mclip-danger)]",
    focusRing,
  ].join(" ");
}

export function archiveRow(isActive: boolean) {
  return [
    "grid h-[34px] w-full grid-cols-[28px_minmax(0,1fr)_18px] items-center rounded-[var(--mclip-radius-sm)] py-0 pl-[5px] pr-[10px] text-left transition-colors duration-150",
    isActive
      ? "[background:var(--mclip-selected-bg)] shadow-[inset_0_0_0_1px_var(--mclip-selection-strong)]"
      : "hover:bg-[var(--mclip-row-hover-bg)]",
    focusRing,
  ].join(" ");
}

export function menuItem(isSelected: boolean, isDanger: boolean, isDisabled = false) {
  return [
    "grid min-h-[26px] w-full grid-cols-[minmax(112px,1fr)_minmax(0,1fr)] items-center gap-2 rounded-[var(--mclip-radius-sm)] pl-1.5 pr-2 text-left transition-colors duration-150",
    isSelected
      ? "[background:var(--mclip-selected-bg)]"
      : "hover:bg-[var(--mclip-row-hover-bg)]",
    isDanger && !isDisabled ? "hover:text-[var(--mclip-danger)]" : "",
    isDisabled ? "cursor-not-allowed opacity-45" : "",
    focusRing,
  ].join(" ");
}

export function previewWindow(hasDetail: boolean, detailSide: "left" | "right", isKeyboardNavigating: boolean) {
  return [
    ui.historyGroupPreviewWindow,
    hasDetail ? ui.historyGroupPreviewWindowWithDetail : "grid-cols-[minmax(0,320px)]",
    hasDetail && detailSide === "left" ? ui.historyGroupPreviewWindowDetailLeft : "",
    isKeyboardNavigating ? "is-keyboard-navigating" : "",
  ].filter(Boolean).join(" ");
}

export function previewItemRow(isSelected: boolean, isKeyboardNavigating: boolean) {
  return [
    "relative grid min-h-[29px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-[var(--mclip-radius-sm)] text-[var(--mclip-ink-soft)] transition-colors transition-shadow duration-150",
    isKeyboardNavigating ? "" : "group",
    isSelected
      ? "[background:var(--mclip-selected-bg)] shadow-[inset_0_0_0_1px_var(--mclip-selection-strong)]"
      : isKeyboardNavigating
        ? "hover:bg-transparent hover:shadow-none"
        : "hover:bg-[var(--mclip-row-hover-bg)]",
  ].join(" ");
}

export function previewItem(showHistoryItemNumbers: boolean) {
  return [
    "grid min-h-[29px] w-full min-w-0 items-center gap-2 rounded-[var(--mclip-radius-sm)] px-2 py-0.5 text-left",
    showHistoryItemNumbers ? "grid-cols-[22px_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)]",
    focusRing,
  ].join(" ");
}

export function previewDeleteButton(isVisible: boolean) {
  return [
    iconButton,
    isVisible
      ? "pointer-events-auto opacity-100"
      : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100",
    "hover:text-[var(--mclip-danger)]",
    focusRing,
  ].join(" ");
}

export function dialogFrame(className = "") {
  return [ui.dialogFrame, className].filter(Boolean).join(" ");
}

export function dialogStatusBar(controlSide: WindowControlSide, centerTitle = false) {
  if (!centerTitle) {
    return ui.dialogStatusBar(controlSide);
  }

  return [
    "relative flex h-9 shrink-0 items-center gap-3 border-b border-[var(--mclip-titlebar-line)] bg-[var(--mclip-titlebar-bg)] px-3 text-[var(--mclip-titlebar-ink)]",
    controlSide === "left" ? "justify-start" : "justify-end",
  ].join(" ");
}

export function windowControls(side: WindowControlSide) {
  return [
    ui.windowControls,
    side === "right" ? "flex-row-reverse" : "",
  ].filter(Boolean).join(" ");
}

export function settingsTab(isActive: boolean) {
  return [
    "min-h-8 rounded-[var(--mclip-radius-sm)] px-2 text-[11px] font-semibold transition-colors duration-150",
    isActive
      ? "bg-[var(--mclip-surface)] text-[var(--mclip-ink)] shadow-sm"
      : "text-[var(--mclip-ink-dim)] hover:bg-[var(--mclip-control-bg-hover)]",
    focusRing,
  ].join(" ");
}

export function menuBarIconOption(isActive: boolean) {
  return [ui.menuBarIconOption, isActive ? ui.menuBarIconOptionActive : ""]
    .filter(Boolean)
    .join(" ");
}

export function settingsSwitchRow(isDisabled = false) {
  return [
    ui.settingsSwitchRow,
    isDisabled ? ui.settingsSwitchRowDisabled : "",
  ].filter(Boolean).join(" ");
}

export function settingsSwitchBox(isOn: boolean) {
  return [ui.settingsSwitchBox, isOn ? ui.settingsSwitchBoxOn : ""]
    .filter(Boolean)
    .join(" ");
}

export function historyTypeRow(isOn: boolean) {
  return [
    "grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--mclip-line)] px-3 text-left last:border-b-0 transition-colors duration-150",
    isOn
      ? "bg-[var(--mclip-selection)]"
      : "hover:bg-[var(--mclip-row-hover-bg)]",
    focusRing,
  ].join(" ");
}
