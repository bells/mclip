import { readFile } from "node:fs/promises";

const TRANSLATION_SOURCE_PATHS = [
  "src/i18n.ts",
  "src/i18n/en.ts",
  "src/i18n/zhCn.ts",
  "src/i18n/ja.ts",
];

export async function readTranslationSources() {
  const sources = await Promise.all(
    TRANSLATION_SOURCE_PATHS.map((path) => readFile(path, "utf8")),
  );
  return sources.join("\n");
}
