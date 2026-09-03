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
  getMainWindowShortcutAction,
  getMainWindowShortcutAriaKeys,
  getMainWindowShortcutKeys,
  getMainWindowShortcutPlatform,
} = await importTypeScriptModule("src/utils/mainWindowShortcuts.ts");

function keyboardEvent(key, overrides = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    key,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

test("footer shortcuts use compact native labels", () => {
  assert.deepEqual(getMainWindowShortcutKeys("clearHistory", "macos"), [
    "⌥",
    "⌘",
    "⌫",
  ]);
  assert.deepEqual(getMainWindowShortcutKeys("preferences", "macos"), ["⌘", ","]);
  assert.deepEqual(getMainWindowShortcutKeys("quit", "macos"), ["⌘", "Q"]);
  assert.deepEqual(getMainWindowShortcutKeys("clearHistory", "other"), [
    "Ctrl",
    "Alt",
    "⌫",
  ]);
  assert.equal(getMainWindowShortcutAriaKeys("preferences", "other"), "Control+,");
});

test("shortcut platform follows the WebView user agent", () => {
  assert.equal(
    getMainWindowShortcutPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    "macos",
  );
  assert.equal(
    getMainWindowShortcutPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
    "other",
  );
});

test("main window actions recognize Command and Control shortcuts", () => {
  assert.equal(
    getMainWindowShortcutAction(
      keyboardEvent("Backspace", { altKey: true, metaKey: true }),
      "macos",
    ),
    "clearHistory",
  );
  assert.equal(
    getMainWindowShortcutAction(keyboardEvent(",", { ctrlKey: true }), "other"),
    "preferences",
  );
  assert.equal(
    getMainWindowShortcutAction(keyboardEvent("Q", { metaKey: true }), "macos"),
    "quit",
  );
});

test("main window shortcuts reject incomplete or conflicting modifiers", () => {
  assert.equal(
    getMainWindowShortcutAction(
      keyboardEvent("Backspace", { metaKey: true }),
      "macos",
    ),
    null,
  );
  assert.equal(
    getMainWindowShortcutAction(
      keyboardEvent("q", { altKey: true, metaKey: true }),
      "macos",
    ),
    null,
  );
  assert.equal(
    getMainWindowShortcutAction(
      keyboardEvent(",", { metaKey: true, shiftKey: true }),
      "macos",
    ),
    null,
  );
  assert.equal(
    getMainWindowShortcutAction(
      keyboardEvent("q", { ctrlKey: true, metaKey: true }),
      "macos",
    ),
    null,
  );
});
