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

test("site describes file history as restorable files, not path-only text", async () => {
  const zh = await read("src/pages/zh/index.astro");
  const en = await read("src/pages/en/index.astro");
  const zhChangelog = await read("src/pages/zh/changelog.astro");
  const enChangelog = await read("src/pages/en/changelog.astro");

  assert.match(zh, /系统文件列表/);
  assert.match(zh, /完整绝对路径/);
  assert.doesNotMatch(zh, /文件路径/);
  assert.match(en, /system file list/);
  assert.match(en, /full absolute path/);
  assert.doesNotMatch(en, /file-path|file paths/);
  assert.match(zhChangelog, /文件保存与回填/);
  assert.match(enChangelog, /file history with file restore/);
});

test("shared SEO metadata declares bilingual routes and social image", async () => {
  const config = await read("astro.config.mjs");
  const layout = await read("src/layouts/SiteLayout.astro");

  assert.match(config, /site: "https:\/\/mclip\.vercel\.app"/);
  assert.match(layout, /https:\/\/mclip\.vercel\.app/);
  assert.match(layout, /hreflang/);
  assert.match(layout, /og:image/);
  assert.match(layout, /twitter:card/);
});

test("layout exposes structured data for search and AI summaries", async () => {
  const layout = await read("src/layouts/SiteLayout.astro");
  const zh = await read("src/pages/zh/index.astro");
  const en = await read("src/pages/en/index.astro");

  assert.match(layout, /application\/ld\+json/);
  assert.match(layout, /@graph/);
  assert.match(layout, /WebSite/);
  assert.match(layout, /Organization/);
  assert.match(layout, /SoftwareApplication/);
  assert.match(layout, /FAQPage/);
  assert.match(layout, /https:\/\/github\.com\/bells\/mclip\/releases/);
  assert.match(zh, /faqItems=\{faqItems\}/);
  assert.match(en, /faqItems=\{faqItems\}/);
});

test("public SEO files expose crawl and sitemap hints", async () => {
  const robots = await read("public/robots.txt");
  const sitemap = await read("public/sitemap.xml");

  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /User-agent: OAI-SearchBot/);
  assert.match(robots, /User-agent: GPTBot/);
  assert.match(robots, /User-agent: Googlebot/);
  assert.match(robots, /User-agent: Baiduspider/);
  assert.match(robots, /Sitemap: https:\/\/mclip\.vercel\.app\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/mclip\.vercel\.app\/zh\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/mclip\.vercel\.app\/en\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/mclip\.vercel\.app\/zh\/changelog\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/mclip\.vercel\.app\/en\/changelog\/<\/loc>/);
  assert.match(sitemap, /hreflang="x-default"/);
});

test("public AI discovery file describes canonical mclip facts", async () => {
  const llms = await read("public/llms.txt");

  assert.match(llms, /# mclip/);
  assert.match(llms, /https:\/\/mclip\.vercel\.app\/zh\//);
  assert.match(llms, /https:\/\/mclip\.vercel\.app\/en\//);
  assert.match(llms, /https:\/\/github\.com\/bells\/mclip\/releases/);
  assert.match(llms, /local-first clipboard history/);
  assert.match(llms, /macOS and Windows/);
  assert.match(llms, /does not upload clipboard contents/);
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
