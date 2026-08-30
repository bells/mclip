import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTranslationSources } from "./helpers/translations.mjs";

const read = (path) => readFile(path, "utf8");

test("desktop pin commands stay typed across Rust, IPC wrappers, and handler registration", async () => {
  const [history, commands, facade, lib] = await Promise.all([
    read("src-tauri/src/history.rs"),
    read("src/services/ipc/commands.ts"),
    read("src/lib/tauri.ts"),
    read("src-tauri/src/lib.rs"),
  ]);

  for (const command of [
    "set_history_item_pinned",
    "toggle_history_item_pinned",
    "clear_history_keep_pinned",
  ]) {
    assert.match(history, new RegExp(`fn ${command}`));
    assert.match(lib, new RegExp(`\\b${command},`));
  }
  assert.match(commands, /invoke<HistoryChange \| null>\("set_history_item_pinned"/);
  assert.match(commands, /invoke<HistoryChange \| null>\("toggle_history_item_pinned"/);
  assert.match(commands, /invoke<HistoryChange \| null>\("clear_history_keep_pinned"/);
  assert.match(facade, /export \* from "\.\.\/services\/ipc\/commands"/);
});

test("pin affordances stay in detail action bars and out of compact list rows", async () => {
  const [mainList, groupList, detailPanel, itemDetail, groupDetail, viewer, windowSource] =
    await Promise.all([
      read("src/components/HistoryList.tsx"),
      read("src/components/HistoryGroupPreviewWindow.tsx"),
      read("src/components/HistoryDetailPanel.tsx"),
      read("src/components/HistoryItemPreviewWindow.tsx"),
      read("src/components/HistoryPreviewDetailWindow.tsx"),
      read("src/components/FullscreenImageViewer.tsx"),
      read("src-tauri/src/window.rs"),
    ]);

  for (const source of [itemDetail, groupDetail, viewer]) {
    assert.match(source, /HistoryPinButton/);
  }
  for (const source of [mainList, groupList]) {
    assert.doesNotMatch(source, /HistoryPinButton/);
  }
  assert.match(detailPanel, /historyPreviewHeader/);
  assert.match(detailPanel, /\{headerAction\}/);
  assert.match(windowSource, /set_focusable\(false\)/);
});

test("the main list separates mixed pin results without section labels or row markers", async () => {
  const [mainList, styles, i18n] = await Promise.all([
    read("src/components/HistoryList.tsx"),
    read("src/uiStyles.ts"),
    readTranslationSources(),
  ]);

  assert.match(
    mainList,
    /index > 0 && items\[index - 1\]\?\.isPinned && !item\.isPinned/,
  );
  assert.match(mainList, /className=\{ui\.historyPinnedDivider\}/);
  assert.match(styles, /historyPinnedDivider:\s*\n\s*"[^"]*h-\[2px\][^"]*rounded-full/);
  assert.doesNotMatch(mainList, /pinnedSectionLabel|recentSectionLabel/);
  assert.doesNotMatch(i18n, /pinnedSectionLabel|recentSectionLabel/);
});

test("archive preview numbering stays local when canonical positions include pins", async () => {
  const groupList = await read("src/components/HistoryGroupPreviewWindow.tsx");

  assert.match(groupList, /preview\.items\.map\(\(item, itemIndex\) =>/);
  assert.match(groupList, /getLocalDisplayPosition\(itemIndex\)/);
  assert.match(groupList, /return String\(itemIndex \+ 1\)/);
  assert.doesNotMatch(groupList, /item\.position - group\.startPosition/);
});

test("clear copy is bilingual and explicitly offers the keep-pinned mode", async () => {
  const [i18n, app] = await Promise.all([
    readTranslationSources(),
    read("src/App.tsx"),
  ]);
  assert.match(i18n, /清除但保留置顶/);
  assert.match(i18n, /Clear, Keep Pinned/);
  assert.match(app, /confirmClearHistory\(true\)/);
  assert.match(app, /message\(pinnedHistoryCount\)/);
});
