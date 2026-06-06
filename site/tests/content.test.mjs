import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Chinese and English homepages expose the core product promise", async () => {
  const zh = await read("src/pages/zh/index.astro");
  const en = await read("src/pages/en/index.astro");

  assert.match(zh, /轻量、本地优先/);
  assert.match(zh, /macOS 和 Windows/);
  assert.match(zh, /下载 mclip/);
  assert.match(en, /Lightweight, local-first/);
  assert.match(en, /macOS and Windows/);
  assert.match(en, /Download mclip/);
});

test("site includes trust, installation, and FAQ content", async () => {
  const zh = await read("src/pages/zh/index.astro");
  const en = await read("src/pages/en/index.astro");

  assert.match(zh, /只保存在本机/);
  assert.match(zh, /macOS 首次打开提示/);
  assert.match(zh, /Windows SmartScreen/);
  assert.match(en, /stays on your computer/);
  assert.match(en, /macOS says the app is damaged/);
  assert.match(en, /Windows SmartScreen/);
});

test("shared SEO metadata declares bilingual routes and social image", async () => {
  const layout = await read("src/layouts/SiteLayout.astro");

  assert.match(layout, /hreflang/);
  assert.match(layout, /og:image/);
  assert.match(layout, /twitter:card/);
});
