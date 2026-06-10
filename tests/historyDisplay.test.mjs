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

const { getHistoryListDisplayText } = await importTypeScriptModule(
  "src/utils/history.ts",
);

function fileItem(filePaths) {
  return {
    copyCount: 1,
    displayText: "backend display",
    filePaths,
    firstCopiedAt: 1,
    id: "h_file",
    kind: "files",
    lastCopiedAt: 1,
    sourceApp: null,
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
