import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

async function importTypeScriptModule(sourcePath) {
  const absoluteSourcePath = path.resolve(sourcePath);
  const source = await readFile(absoluteSourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absoluteSourcePath,
  });
  const compiledPath = path.join(
    tmpdir(),
    `mclip-${path.basename(sourcePath, ".ts")}-${Date.now()}.mjs`,
  );

  await writeFile(compiledPath, output.outputText, "utf8");

  return import(compiledPath);
}

const {
  filterHistoryItems,
  getHistoryGroupItems,
  getHistoryGroups,
  getHistoryListDisplayText,
  getVisibleHistoryItems,
  splitPinnedHistoryItems,
} = await importTypeScriptModule(
  "src/utils/history.ts",
);

function fileItem(filePaths) {
  return {
    copyCount: 1,
    displayText: "backend display",
    filePaths,
    firstCopiedAt: 1,
    id: "h_file",
    isPinned: false,
    kind: "files",
    lastCopiedAt: 1,
    pinnedAt: null,
    sourceApp: null,
  };
}

function textItem(id, lastCopiedAt, isPinned = false, pinnedAt = null) {
  return {
    copyCount: 1,
    displayText: id,
    firstCopiedAt: 1,
    id,
    isPinned,
    kind: "text",
    lastCopiedAt,
    pinnedAt,
    sourceApp: null,
    text: id,
  };
}

test("file history list display uses middle ellipsis and keeps extension", () => {
  assert.equal(
    getHistoryListDisplayText(
      fileItem([
        "/Users/watson/Downloads/qrcode96965c69-7aba-42ea-b7c6-8b4ac7b18fbb.pdf",
      ]),
    ),
    "qrcode96965c69...c7b18fbb.pdf",
  );
});

test("short file history list display keeps the original filename", () => {
  assert.equal(
    getHistoryListDisplayText(fileItem(["/Users/watson/Movies/RPReplay_Final1777600013.MP4"])),
    "RPReplay_Final1777600013.MP4",
  );
});

test("multiple file history list display keeps the count suffix", () => {
  assert.equal(
    getHistoryListDisplayText(
      fileItem([
        "/Users/watson/Downloads/qrcode96965c69-7aba-42ea-b7c6-8b4ac7b18fbb.pdf",
        "/Users/watson/Downloads/notes.txt",
      ]),
    ),
    "qrcode96965c69...18fbb.pdf +1",
  );
});

test("archive groups use compact rows without decorative gaps", async () => {
  const stylesSource = await readFile("src/uiStyles.ts", "utf8");

  assert.match(stylesSource, /archive: "-mt-1[^"]*pb-0/);
  assert.match(
    stylesSource,
    /archiveDivider:\s*\n\s*"[^"]*-mb-px[^"]*h-px/,
  );
  assert.match(stylesSource, /archiveList: "grid content-start gap-0"/);
  assert.match(stylesSource, /export function archiveRow[\s\S]*"grid h-\[28px\]/);
});

test("pins do not consume the main or archive count and search keeps pins first", () => {
  const history = [
    textItem("pin", 5, true, 10),
    textItem("recent", 4),
    textItem("older", 3),
    textItem("oldest", 2),
  ];
  const filtered = filterHistoryItems(history, "");
  const { pinned, unpinned } = splitPinnedHistoryItems(filtered);
  const visible = getVisibleHistoryItems(filtered, 2);
  const groups = getHistoryGroups(unpinned.length, 2, 2);

  assert.deepEqual(pinned.map((item) => item.id), ["pin"]);
  assert.deepEqual(visible.map((item) => item.id), ["pin", "recent", "older"]);
  assert.equal(groups[1].startPosition, 3);
  assert.equal(groups[1].endPosition, 4);
  assert.deepEqual(getHistoryGroupItems(filtered, groups[1]).map((item) => item.id), ["oldest"]);
});

test("the TypeScript common history contract names both pin fields exactly", async () => {
  const source = await readFile("src/types.ts", "utf8");
  assert.match(source, /isPinned: boolean/);
  assert.match(source, /pinnedAt: number \| null/);
  assert.doesNotMatch(source, /is_pinned|pinned_at/);
});
