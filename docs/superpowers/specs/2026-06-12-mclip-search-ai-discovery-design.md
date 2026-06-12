# mclip Search And AI Discovery Design

Date: 2026-06-12
Site: https://mclip.vercel.app

## Goal

Make the mclip public site easier for search engines and AI search tools to crawl, understand, summarize, and cite. The work should strengthen the existing Astro site instead of changing the product positioning or turning the site into keyword-heavy marketing.

## Scope

This design covers the site in `site/` only. It keeps the existing bilingual homepage structure:

- Chinese default page: `https://mclip.vercel.app/zh/`
- English page: `https://mclip.vercel.app/en/`
- Root redirect: `https://mclip.vercel.app/`
- Changelog pages under `/zh/changelog/` and `/en/changelog/`

The implementation will not add broad comparison pages, blog posts, or programmatic keyword pages in this pass.

## Existing Base

The current site already has a solid first layer:

- Static Astro output with `site: "https://mclip.vercel.app"`
- Bilingual homepages
- Canonical URLs
- `hreflang` alternates
- Open Graph and Twitter image metadata
- `robots.txt`
- `sitemap.xml`
- FAQ content
- Content tests for key homepage claims and crawl files

The next useful layer is structured, machine-readable product facts.

## Recommended Approach

Use the approved Scheme B: SEO plus an AI-readable fact layer.

1. Preserve normal SEO basics.
2. Add JSON-LD structured data for the product, site, publisher, and FAQs.
3. Add an `llms.txt` file that gives AI tools a concise, stable map of what mclip is and where important pages live.
4. Keep crawl hints open for mainstream search and AI search crawlers.
5. Add tests that make the discovery layer hard to accidentally break.

## Data Model

The site should expose a small set of canonical facts:

- Product name: mclip
- Product type: local-first clipboard history desktop app
- Platforms: macOS and Windows
- Core capabilities: text history, image history, file history, search, previews, tray/menu-bar access, global shortcut, preferences
- Privacy boundary: clipboard history and settings stay local; mclip does not upload clipboard contents
- Source code: https://github.com/bells/mclip
- Releases: https://github.com/bells/mclip/releases
- Current site URL: https://mclip.vercel.app
- Current version in site copy: 0.1.0

These facts should appear in user-visible copy and machine-readable files. If the product version changes later, the visible copy, JSON-LD, `llms.txt`, and tests should be updated together.

## Structured Data

Add JSON-LD through the shared site layout so every locale page can emit correct metadata. The first implementation should include:

- `WebSite`: site name, URL, language alternates.
- `Organization`: publisher identity and GitHub link.
- `SoftwareApplication`: product identity, operating systems, application category, current version, release/download URL, privacy-oriented description.
- `FAQPage`: generated from the existing FAQ items on each homepage.

The FAQ structured data should be generated from the same FAQ arrays used by the visible page content, so there is no separate copy to drift.

## AI-Readable File

Add `site/public/llms.txt`.

The file should be short, plain Markdown, and written for retrieval systems:

- One clear product summary.
- Key URLs for Chinese, English, changelog, GitHub, and releases.
- A concise facts section.
- A privacy and trust section.
- A short note that the site is the canonical public site for mclip.

This is additive. It does not replace `robots.txt`, `sitemap.xml`, or visible page content.

## Robots And Sitemap

Keep `robots.txt` open:

- Allow normal web crawlers.
- Keep the sitemap pointer to `https://mclip.vercel.app/sitemap.xml`.
- Avoid blocking AI search crawlers such as OpenAI search crawlers unless there is a future privacy or licensing reason to do so.

Update tests so the official domain remains consistent in `astro.config.mjs`, layout metadata, robots, sitemap, and `llms.txt`.

## Copy Guidelines

Do:

- Use direct product language: "clipboard history", "macOS and Windows", "local-first", "text, images, and files".
- Keep Chinese and English meanings aligned.
- State trust boundaries plainly.
- Mention current signing/notarization limitations where downloads are discussed.

Do not:

- Stuff repeated search keywords into headings.
- Add unsupported claims such as cloud sync, notarization, code signing, or store distribution.
- Present mclip as an AI product.
- Hide limitations that affect install trust.

## Testing

Update `site/tests/content.test.mjs` to cover:

- `llms.txt` exists and includes canonical product facts.
- `robots.txt` points to the canonical sitemap.
- JSON-LD contains `SoftwareApplication`, `WebSite`, `Organization`, and `FAQPage`.
- FAQ structured data is present for both Chinese and English pages.
- The canonical domain is consistently `https://mclip.vercel.app`.

Run:

```bash
npm --prefix site test
npm --prefix site run build
```

If the broader app is touched accidentally, run the repo-level check before finishing. The intended scope is site-only.

## Acceptance Criteria

The work is complete when:

- The public site still builds as a static Astro site.
- `https://mclip.vercel.app/robots.txt` and `/sitemap.xml` remain valid crawl hints.
- `/llms.txt` exists and gives AI tools a concise product map.
- Homepage HTML includes structured data that matches visible page content.
- Tests protect the new discovery layer.
- No app runtime code under `src/` or `src-tauri/` is changed.
