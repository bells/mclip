import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function cssRule(selector) {
  const css = await readFile("src/App.css", "utf8");
  const match = css.match(new RegExp(`${selector} \\{([\\s\\S]*?)\\}`));

  assert.ok(match, `${selector} rule should exist`);
  return match[1];
}

test("file history detail paths wrap instead of truncating", async () => {
  const rule = await cssRule("\\.app-history-detail-file");

  assert.match(rule, /overflow-wrap:\s*anywhere;/);
  assert.match(rule, /white-space:\s*normal;/);
  assert.doesNotMatch(rule, /text-overflow:\s*ellipsis;/);
});
