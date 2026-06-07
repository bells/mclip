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

test("public SEO files expose crawl and sitemap hints", async () => {
  const robots = await read("public/robots.txt");
  const sitemap = await read("public/sitemap.xml");

  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/mclip\.app\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/mclip\.app\/zh\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/mclip\.app\/en\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/mclip\.app\/zh\/changelog\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/mclip\.app\/en\/changelog\/<\/loc>/);
  assert.match(sitemap, /hreflang="x-default"/);
});

test("layout bundles the site stylesheet through Astro", async () => {
  const layout = await read("src/layouts/SiteLayout.astro");

  assert.match(layout, /import "\.\.\/styles\/global\.css";/);
  assert.doesNotMatch(layout, /href="\/styles\/global\.css"/);
});

test("hero preview image uses the real PNG aspect ratio", async () => {
  const hero = await read("src/components/Hero.astro");
  const css = await read("src/styles/global.css");
  const png = await readFile(
    new URL("../public/screenshots/mclip-product-preview.png", import.meta.url),
  );
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  assert.match(hero, new RegExp(`width="${width}"`));
  assert.match(hero, new RegExp(`height="${height}"`));
  assert.match(css, /\.hero-product\s*{[^}]*height:\s*auto;/s);
});
