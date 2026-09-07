import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

  return import(pathToFileURL(compiledPath).href);
}

const {
  getGroupPreviewNaturalHeight,
  getGroupPreviewHeight,
  getItemPreviewAnchorTop,
  getItemPreviewHeight,
  getItemPreviewNaturalHeight,
  normalizeMeasuredPreviewHeight,
  shouldApplyMeasuredPreviewHeight,
} = await importTypeScriptModule("src/utils/preview.ts");

test("history group preview uses the same text and image row heights as the main list", () => {
  assert.equal(
    getGroupPreviewHeight([
      { kind: "text" },
      { kind: "files" },
      { kind: "image" },
    ]),
    168,
  );
});

test("history group preview natural height follows rendered content", () => {
  assert.equal(getGroupPreviewNaturalHeight(37.2, 312.1, 2), 352);
  assert.equal(normalizeMeasuredPreviewHeight(Number.NaN), null);
  assert.equal(normalizeMeasuredPreviewHeight(0), null);
});

test("history group preview ignores duplicate measured heights", () => {
  assert.equal(shouldApplyMeasuredPreviewHeight(null, 352), true);
  assert.equal(shouldApplyMeasuredPreviewHeight(352, 353), false);
  assert.equal(shouldApplyMeasuredPreviewHeight(352, 354), true);
});

test("item detail preview sizing follows the compact preview chrome", () => {
  assert.equal(
    getItemPreviewHeight({
      kind: "text",
      text: "short copied text",
    }),
    336,
  );
  assert.equal(getItemPreviewAnchorTop(100), 54);
});

test("text tool height respects disabled groups and preserves non-text sizing", () => {
  const item = {kind:"text",text:"short"};
  assert.equal(getItemPreviewHeight(item,{json:false,base64:false,urlComponent:false}),204);
  assert.equal(getItemPreviewHeight(item,{json:true,base64:false,urlComponent:false}),268);
  assert.equal(getItemPreviewHeight({kind:"image"}),276);
  assert.ok(getItemPreviewHeight({...item,text:"a\nb\nc\nd\ne"}) > getItemPreviewHeight(item));
});


test("detail height tracks actual rows without reserving disabled or inapplicable actions", () => {
  assert.equal(getItemPreviewNaturalHeight(45, 130, 84, 27), 286);
  assert.equal(getItemPreviewNaturalHeight(45, 160, 84, 27), 316);
  assert.equal(getItemPreviewNaturalHeight(45, 46, 84, 27), 202);
  assert.equal(getItemPreviewNaturalHeight(45, 5000, 84, 27), 516);
  assert.equal(getItemPreviewNaturalHeight(45, NaN, 84, 27), null);
});
