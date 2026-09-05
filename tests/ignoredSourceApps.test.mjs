import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadModule(path) {
  const source = await readFile(path, "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("application selection deduplicates without reordering or changing existing identifiers", async () => {
  const { mergeIgnoredSourceAppIds } = await loadModule("src/utils/ignoredSourceApps.ts");
  const existing = ["macos:com.example.one", "windows:legacy.exe"];
  assert.deepEqual(mergeIgnoredSourceAppIds(existing, ["macos:com.example.one", "macos:com.example.two", "macos:com.example.two"], 100), [...existing, "macos:com.example.two"]);
  assert.deepEqual(existing, ["macos:com.example.one", "windows:legacy.exe"]);
});

test("cancel and duplicate selection are safe at capacity, excess batches are rejected", async () => {
  const { mergeIgnoredSourceAppIds } = await loadModule("src/utils/ignoredSourceApps.ts");
  const existing = Array.from({ length: 100 }, (_, index) => `macos:com.example.app${index}`);
  assert.deepEqual(mergeIgnoredSourceAppIds(existing, [], 100), existing);
  assert.deepEqual(mergeIgnoredSourceAppIds(existing, [existing[0]], 100), existing);
  assert.equal(mergeIgnoredSourceAppIds(existing, ["macos:com.example.new"], 100), null);
});

test("failed application changes roll back using the settings controller", async () => {
  const { createPreferenceSaveController } = await loadModule("src/components/preferences/preferenceSaveController.ts");
  let state;
  let feedback;
  const original = { ignoredSourceAppIds: ["macos:com.example.old"], appearanceTheme: "dark" };
  const controller = createPreferenceSaveController({ initialSettings: original, normalize: (value) => value, onSettings: (value) => { state = value; }, onFeedback: (value) => { feedback = value; }, save: async () => { throw new Error("fixture failure"); } });
  const pending = controller.apply("privacy.source-exclusion", (current) => ({ ...current, ignoredSourceAppIds: [] }));
  assert.deepEqual(state.ignoredSourceAppIds, []);
  await pending;
  assert.deepEqual(state, original);
  assert.equal(feedback["privacy.source-exclusion"], "error");
});
