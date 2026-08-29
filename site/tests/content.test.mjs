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

test("site publishes the v0.1.1 release and current product capabilities", async () => {
  const zh = await read("src/pages/zh/index.astro");
  const en = await read("src/pages/en/index.astro");
  const zhChangelog = await read("src/pages/zh/changelog.astro");
  const enChangelog = await read("src/pages/en/changelog.astro");
  const layout = await read("src/layouts/SiteLayout.astro");
  const llms = await read("public/llms.txt");

  assert.match(zh, /当前版本 0\.1\.1/);
  assert.match(en, /Current version 0\.1\.1/);
  assert.match(zhChangelog, /0\.1\.1/);
  assert.match(zhChangelog, /Tailwind CSS 4/);
  assert.match(zhChangelog, /更快、更清晰的完整核心体验/);
  assert.match(zhChangelog, /托盘就绪中位数提升 51\.3%/);
  assert.match(zhChangelog, /SHA-256/);
  assert.match(enChangelog, /0\.1\.1/);
  assert.match(enChangelog, /System\/Light\/Dark/);
  assert.match(enChangelog, /A faster, clearer complete core experience/);
  assert.match(enChangelog, /tray-ready median improved 51\.3%/);
  assert.match(layout, /softwareVersion: "0\.1\.1"/);
  assert.match(llms, /Current public version: 0\.1\.1/);
  assert.match(llms, /independent detail window/);
  assert.match(zh, /Windows CLI 用户请在 Git Bash/);
  assert.match(zh, /SHA-256 校验资产/);
  assert.match(en, /Windows CLI users should run it from Git Bash/);
  assert.match(en, /SHA-256 companion/);
  assert.match(llms, /On Windows, run the shell installer from Git Bash/);
  assert.match(llms, /preserves an existing CLI on verification failure/);
  assert.match(zh, /最多可将 100 条常用记录置顶/);
  assert.match(en, /Pin up to 100 frequently reused items/);
  assert.match(llms, /mclip-cli list --pinned --json/);
  assert.match(llms, /--keep-pinned/);
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

test("bilingual privacy copy states masking and source-exclusion limits", async () => {
  const zh = await read("src/pages/zh/index.astro");
  const en = await read("src/pages/en/index.astro");
  const zhChangelog = await read("src/pages/zh/changelog.astro");
  const enChangelog = await read("src/pages/en/changelog.astro");
  const llms = await read("public/llms.txt");

  assert.match(zh, /遮罩不是静态加密/);
  assert.match(zh, /纯 Wayland 当前无法执行来源应用排除/);
  assert.match(en, /masking is not encryption at rest/i);
  assert.match(en, /unavailable on pure Wayland/);
  assert.match(zhChangelog, /可能误报或漏报/);
  assert.match(zhChangelog, /本地明文/);
  assert.match(enChangelog, /false positives or false negatives/);
  assert.match(enChangelog, /local plaintext/);
  assert.match(llms, /--reveal-secrets/);
  assert.match(llms, /Agent JSON uses schema version 2/);
  assert.match(llms, /Masking is not encryption at rest/);
  assert.match(llms, /pure Wayland source exclusion is currently unavailable/);
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
  assert.match(zh, /mclip-cli transform json-prettify/);
  assert.match(en, /mclip-cli transform json-prettify/);
  assert.match(zh, /pipeline clipboard text/);
  assert.match(en, /pipeline clipboard text/);
  assert.match(llms, /mclip-cli agent --last 5 --json/);
  assert.match(llms, /command capability map/);
  assert.match(llms, /mclip-cli clear --yes/);
  assert.match(llms, /content-only stdout/);
  assert.match(llms, /1 MiB input and 4 MiB output/);
  assert.match(llms, /mclip-cli/);
  assert.match(llms, /https:\/\/www\.mclip\.cn\/install\.sh/);
  assert.match(llms, /MCLIP_VERSION/);
  assert.match(llms, /missing\/outdated\/unknown\/current\/newer/);
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
  assert.match(layout, /VideoObject/);
  assert.match(layout, /mclip-v0\.1\.1-demo\.mp4/);
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

test("hero uses a tall autoplaying product video with a poster fallback", async () => {
  const hero = await read("src/components/Hero.astro");
  const css = await read("src/styles/global.css");
  const renderer = await read("scripts/render-hero-video.m");
  const video = await readFile(
    new URL("../public/videos/mclip-v0.1.1-demo.mp4", import.meta.url),
  );
  const poster = await readFile(
    new URL("../public/videos/mclip-v0.1.1-demo-poster.png", import.meta.url),
  );
  const width = poster.readUInt32BE(16);
  const height = poster.readUInt32BE(20);

  assert.match(hero, /<video/);
  assert.match(hero, /autoplay/);
  assert.match(hero, /loop/);
  assert.match(hero, /muted/);
  assert.match(hero, /playsinline/);
  assert.match(hero, /preload="auto"/);
  assert.match(hero, /poster="\/videos\/mclip-v0\.1\.1-demo-poster\.png"/);
  assert.match(hero, /src="\/videos\/mclip-v0\.1\.1-demo\.mp4" type="video\/mp4"/);
  assert.match(hero, new RegExp(`width="${width}"`));
  assert.match(hero, new RegExp(`height="${height}"`));
  assert.equal(video.subarray(4, 8).toString("ascii"), "ftyp");
  assert.ok(video.byteLength < 1_500_000, "hero video should stay below 1.5 MB");
  assert.match(hero, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.hero-product\s*{[^}]*height:\s*auto;/s);
  assert.match(css, /\.hero-product\s*{[^}]*aspect-ratio:\s*4 \/ 3;/s);
  assert.match(css, /\.hero-figure\s*{[^}]*margin-top:\s*60px;/s);
  assert.match(css, /\.hero-figure figcaption\s*{[^}]*margin:\s*16px 0 0 auto;/s);
  assert.doesNotMatch(css, /\.hero-figure figcaption\s*{[^}]*margin:\s*-/s);
  assert.match(renderer, /@"history"/);
  assert.match(renderer, /searchNumbers = @\[ @2, @7, @12, @18/);
  assert.match(renderer, /File history pastes back as real files/);
  assert.match(renderer, /Text #18/);
  assert.match(renderer, /Finder or Explorer/);
  assert.doesNotMatch(renderer, /OpenSpec|http_proxy|IMG_1363|Almanac|Sublime Text/);
  assert.match(renderer, /height = 842\.0 - filtered \* 128\.0/);
  assert.match(renderer, /footerY = y \+ height - 142\.0/);
});

test("mobile layout wraps long copy and isolates the hero image", async () => {
  const css = await read("src/styles/global.css");

  assert.match(css, /overflow-x:\s*clip;/);
  assert.match(css, /overflow-wrap:\s*anywhere;/);
  assert.match(css, /\.agent-cli-board,[\s\S]*?\{\s*min-width:\s*0;/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*\.hero-figure\s*{[^}]*overflow:\s*hidden;/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*\.agent-terminal code\s*{[^}]*white-space:\s*pre-wrap;/);
});
