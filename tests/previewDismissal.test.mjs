import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(compiledPath, output.outputText, "utf8"),
  );

  return import(compiledPath);
}

const {
  beginPreviewOpenRequest,
  cancelPreviewOpenRequests,
  canCompletePreviewOpenRequest,
  canStartPreviewOpenRequest,
  createPreviewDismissalState,
  dismissPreviewForSelection,
  resetPreviewSelectionDismissal,
} = await importTypeScriptModule("src/utils/previewDismissal.ts");

test("selection dismissal cancels an already-started preview open request", () => {
  let state = createPreviewDismissalState();
  const request = beginPreviewOpenRequest(state);

  state = dismissPreviewForSelection(state);

  assert.equal(canCompletePreviewOpenRequest(state, request), false);
});

test("selection dismissal suppresses new hover opens until the main window is shown again", () => {
  let state = createPreviewDismissalState();

  state = dismissPreviewForSelection(state);
  assert.equal(canStartPreviewOpenRequest(state), false);

  state = resetPreviewSelectionDismissal(state);
  assert.equal(canStartPreviewOpenRequest(state), true);
});

test("plain preview close cancels in-flight opens without suppressing later hover", () => {
  let state = createPreviewDismissalState();
  const request = beginPreviewOpenRequest(state);

  state = cancelPreviewOpenRequests(state);

  assert.equal(canCompletePreviewOpenRequest(state, request), false);
  assert.equal(canStartPreviewOpenRequest(state), true);
});

test("a fresh request can complete while preview opening is not suppressed", () => {
  const state = createPreviewDismissalState();
  const request = beginPreviewOpenRequest(state);

  assert.equal(canCompletePreviewOpenRequest(state, request), true);
});
