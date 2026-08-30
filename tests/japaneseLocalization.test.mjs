import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { readTranslationSources } from "./helpers/translations.mjs";

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
    `mclip-japanese-${Date.now()}-${Math.random()}.mjs`,
  );
  await writeFile(compiledPath, output.outputText, "utf8");
  return import(compiledPath);
}

const { getDisplayLocale, resolveAppLanguage, resolveSupportedLanguage } =
  await importTypeScriptModule("src/utils/language.ts");

test("Japanese and fallback locale resolution are deterministic", () => {
  assert.equal(resolveSupportedLanguage("ja"), "ja");
  assert.equal(resolveSupportedLanguage("JA-jp"), "ja");
  assert.equal(resolveSupportedLanguage("zh-Hans"), "zhCn");
  assert.equal(resolveSupportedLanguage("es-ES"), "en");
  assert.equal(resolveAppLanguage("ja"), "ja");
  assert.equal(getDisplayLocale("ja"), "ja-JP");
  assert.equal(getDisplayLocale("zhCn"), "zh-CN");
  assert.equal(getDisplayLocale("en"), "en-US");
});

test("Japanese stays symmetric across settings, Preferences, and translation modules", async () => {
  const [types, settings, preferences, translations, index] = await Promise.all([
    readFile("src/types.ts", "utf8"),
    readFile("src/utils/settings.ts", "utf8"),
    readFile("src/components/PreferencesWindow.tsx", "utf8"),
    readTranslationSources(),
    readFile("src/i18n.ts", "utf8"),
  ]);

  assert.match(types, /ResolvedAppLanguage = "zhCn" \| "en" \| "ja"/);
  assert.match(settings, /\["system", "zhCn", "en", "ja"\]/);
  assert.match(preferences, /<option value="ja">\{t\.languageJapanese\}<\/option>/);
  assert.match(translations, /languageJapanese: "日本語"/);
  assert.match(translations, /履歴項目|クリップボード履歴/);
  assert.match(index, /Record<ResolvedAppLanguage, AppTranslations>/);
  assert.match(index, /ja: jaTranslations/);
  assert.match(translations, /satisfies AppTranslations/g);
});

test("language remains presentation-only for canonical clipboard actions", async () => {
  const [actions, commands, quickActions] = await Promise.all([
    readFile("src/hooks/useClipboardActions.ts", "utf8"),
    readFile("src/services/ipc/commands.ts", "utf8"),
    readFile("src/services/quickActions.ts", "utf8"),
  ]);

  assert.match(actions, /await copyHistoryItem\(id\)/);
  assert.match(
    commands,
    /copyHistoryItem\(id: string\)[\s\S]*invoke(?:<void>)?\("copy_history_item", \{ id \}\)/,
  );
  assert.doesNotMatch(commands, /copyHistoryItem\([^)]*language/);
  assert.match(quickActions, /input: input\.item\.text/);
  assert.match(quickActions, /language: input\.language/);
});

test("every language-sensitive number formatter uses the shared locale helper", async () => {
  const sources = await readTranslationSources();
  const historyPanel = await readFile("src/components/HistoryDetailPanel.tsx", "utf8");

  assert.doesNotMatch(sources, /toLocaleString\("(?:zh-CN|en-US|ja-JP)"\)/);
  assert.match(sources, /getDisplayLocale\("zhCn"\)/);
  assert.match(sources, /getDisplayLocale\("en"\)/);
  assert.match(sources, /getDisplayLocale\("ja"\)/);
  assert.match(historyPanel, /Intl\.DateTimeFormat\(getDisplayLocale\(language\)/);
});
