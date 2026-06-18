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

test("root path redirects at the Vercel edge instead of rendering a temporary page", async () => {
  const config = JSON.parse(await read("vercel.json"));
  const redirects = config.redirects ?? [];

  assert.deepEqual(redirects[0], {
    source: "/",
    destination: "/en/",
    permanent: false,
  });
  await assert.rejects(read("src/pages/index.astro"), { code: "ENOENT" });
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

test("site introduces AI Agent and mclip-cli workflows", async () => {
  const hero = await read("src/components/Hero.astro");
  const zh = await read("src/pages/zh/index.astro");
  const en = await read("src/pages/en/index.astro");
  const llms = await read("public/llms.txt");

  assert.match(hero, /#agents/);
  assert.match(zh, /AI Agent 与 CLI/);
  assert.match(zh, /Codex、Claude Code、Cursor、Cline/);
  assert.match(zh, /curl -fsSL https:\/\/www\.mclip\.cn\/install\.sh \| sh/);
  assert.match(zh, /Agent 模式/);
  assert.match(zh, /mclip-cli agent --last 5 --json/);
  assert.match(zh, /mclip-cli list --limit 5 --json/);
  assert.match(zh, /mclip-cli context --last 3 --format markdown/);
  assert.match(en, /AI Agent and CLI/);
  assert.match(en, /Codex, Claude Code, Cursor, and Cline/);
  assert.match(en, /Agent Mode/);
  assert.match(en, /mclip-cli list --limit 5 --json/);
  assert.match(zh, /mclip-cli add/);
  assert.match(en, /mclip-cli copy --index 1/);
  assert.match(llms, /mclip-cli agent --last 5 --json/);
  assert.match(llms, /command capability map/);
  assert.match(llms, /mclip-cli clear --yes/);
  assert.match(llms, /mclip-cli/);
  assert.match(llms, /https:\/\/www\.mclip\.cn\/install\.sh/);
});

test("shared SEO metadata declares bilingual routes and social image", async () => {
  const config = await read("astro.config.mjs");
  const layout = await read("src/layouts/SiteLayout.astro");

  assert.match(config, /site: "https:\/\/www\.mclip\.cn"/);
  assert.match(layout, /https:\/\/www\.mclip\.cn/);
  assert.match(layout, /hreflang/);
  assert.match(layout, /alternateZhPath/);
  assert.match(layout, /alternateEnPath/);
  assert.match(layout, /hreflang="x-default" href=\{alternateEn\}/);
  assert.match(layout, /og:image/);
  assert.match(layout, /og:image:alt/);
  assert.match(layout, /twitter:card/);
  assert.match(layout, /twitter:url/);
});

test("layout exposes structured data for search and AI summaries", async () => {
  const layout = await read("src/layouts/SiteLayout.astro");
  const zh = await read("src/pages/zh/index.astro");
  const en = await read("src/pages/en/index.astro");

  assert.match(layout, /application\/ld\+json/);
  assert.match(layout, /@graph/);
  assert.match(layout, /WebSite/);
  assert.match(layout, /WebPage/);
  assert.match(layout, /Organization/);
  assert.match(layout, /SoftwareApplication/);
  assert.match(layout, /FAQPage/);
  assert.match(layout, /installUrl/);
  assert.match(layout, /AI Agent clipboard context/);
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
  assert.match(robots, /User-agent: ChatGPT-User/);
  assert.match(robots, /User-agent: GPTBot/);
  assert.match(robots, /User-agent: PerplexityBot/);
  assert.match(robots, /User-agent: ClaudeBot/);
  assert.match(robots, /User-agent: Claude-SearchBot/);
  assert.match(robots, /User-agent: Googlebot/);
  assert.match(robots, /User-agent: Bingbot/);
  assert.match(robots, /User-agent: Baiduspider/);
  assert.match(robots, /Sitemap: https:\/\/www\.mclip\.cn\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/www\.mclip\.cn\/zh\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.mclip\.cn\/en\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.mclip\.cn\/zh\/changelog\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.mclip\.cn\/en\/changelog\/<\/loc>/);
  assert.match(sitemap, /hreflang="x-default" href="https:\/\/www\.mclip\.cn\/en\/"/);
  assert.match(sitemap, /hreflang="x-default" href="https:\/\/www\.mclip\.cn\/en\/changelog\/"/);
});

test("public AI discovery file describes canonical mclip facts", async () => {
  const llms = await read("public/llms.txt");

  assert.match(llms, /# mclip/);
  assert.match(llms, /Default homepage: https:\/\/www\.mclip\.cn\/en\//);
  assert.match(llms, /https:\/\/www\.mclip\.cn\/zh\//);
  assert.match(llms, /https:\/\/www\.mclip\.cn\/en\//);
  assert.match(llms, /https:\/\/github\.com\/bells\/mclip\/releases/);
  assert.match(llms, /local-first clipboard history/);
  assert.match(llms, /中文摘要/);
  assert.match(llms, /macOS and Windows/);
  assert.match(llms, /does not upload clipboard contents/);
  assert.match(llms, /Do not claim that mclip has cloud sync/);
});

test("footer exposes the AI-readable llms.txt file", async () => {
  const footer = await read("src/components/SiteFooter.astro");

  assert.match(footer, /href="\/llms\.txt"/);
});

test("public install script mirrors the root mclip-cli installer", async () => {
  const rootInstaller = await read("../install.sh");
  const publicInstaller = await read("public/install.sh");

  assert.equal(publicInstaller, rootInstaller);
  assert.match(publicInstaller, /BIN_NAME="mclip-cli"/);
  assert.match(publicInstaller, /https:\/\/github\.com\/bells\/mclip\.git/);
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
  assert.match(css, /\.hero-figure figcaption\s*{[^}]*margin:\s*16px 0 0 auto;/s);
  assert.doesNotMatch(css, /\.hero-figure figcaption\s*{[^}]*margin:\s*-/s);
});

test("mobile layout wraps long copy and isolates the hero image", async () => {
  const css = await read("src/styles/global.css");

  assert.match(css, /overflow-x:\s*clip;/);
  assert.match(css, /overflow-wrap:\s*anywhere;/);
  assert.match(css, /\.agent-cli-board,[\s\S]*?\{\s*min-width:\s*0;/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*\.hero-figure\s*{[^}]*overflow:\s*hidden;/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*\.agent-terminal code\s*{[^}]*white-space:\s*pre-wrap;/);
});
