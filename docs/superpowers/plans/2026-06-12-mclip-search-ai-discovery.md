# mclip Search AI Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tested SEO and AI-readable discovery layer to the existing mclip Astro site.

**Architecture:** Keep the public site static. Generate JSON-LD from the shared Astro layout using the same homepage FAQ arrays that render visible FAQ content, and expose a concise `llms.txt` from `site/public/`.

**Tech Stack:** Astro 6, Node test runner, static files under `site/public/`.

---

### Task 1: Discovery Tests

**Files:**
- Modify: `site/tests/content.test.mjs`

- [ ] **Step 1: Write failing tests**

Add tests that read the source files and built HTML to assert:

```js
assert.match(layout, /application\/ld\+json/);
assert.match(layout, /SoftwareApplication/);
assert.match(layout, /FAQPage/);
assert.match(llms, /# mclip/);
assert.match(llms, /https:\/\/mclip\.vercel\.app\/zh\//);
assert.match(llms, /local-first clipboard history/);
assert.match(robots, /Sitemap: https:\/\/mclip\.vercel\.app\/sitemap\.xml/);
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm --prefix site test
```

Expected: fail because `llms.txt` is missing and JSON-LD is not present in the layout yet.

### Task 2: JSON-LD And AI Text File

**Files:**
- Modify: `site/src/layouts/SiteLayout.astro`
- Modify: `site/src/pages/zh/index.astro`
- Modify: `site/src/pages/en/index.astro`
- Create: `site/public/llms.txt`

- [ ] **Step 1: Add layout-generated JSON-LD**

Update the layout props to accept optional FAQ items. Build a Schema.org `@graph` containing `WebSite`, `Organization`, `SoftwareApplication`, and locale-specific `FAQPage` when FAQ items exist. Render it as:

```astro
<script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
```

- [ ] **Step 2: Pass homepage FAQ arrays into the layout**

Add `faqItems={faqItems}` to the Chinese and English homepage `SiteLayout` calls.

- [ ] **Step 3: Add `llms.txt`**

Create a short Markdown file with the canonical site URL, language pages, changelog pages, GitHub, releases, product facts, and privacy boundary.

- [ ] **Step 4: Verify green**

Run:

```bash
npm --prefix site test
```

Expected: all content tests pass.

### Task 3: Build Verification And Commit

**Files:**
- Verify all files touched in Tasks 1 and 2.

- [ ] **Step 1: Build the static site**

Run:

```bash
npm --prefix site run build
```

Expected: Astro builds the static site with no errors.

- [ ] **Step 2: Check whitespace and changed scope**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only site discovery files and docs plan are changed.

- [ ] **Step 3: Commit**

Stage and commit the implementation files:

```bash
git add docs/superpowers/plans/2026-06-12-mclip-search-ai-discovery.md site/src/layouts/SiteLayout.astro site/src/pages/zh/index.astro site/src/pages/en/index.astro site/public/llms.txt site/tests/content.test.mjs
git commit -m "Improve site search and AI discovery"
```
