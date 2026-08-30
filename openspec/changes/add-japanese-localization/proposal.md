## Why

mclip currently serves Chinese- and English-speaking users, but its compact macOS/Windows utility model is also a strong fit for Japanese users. Japanese is the best next product language for this stage because it extends the product into another desktop-focused market while reusing the existing CJK layout baseline and avoiding the broader pluralization, regional-variant, and bidirectional-layout work that other candidates would introduce.

## What Changes

- Add Japanese (`ja`) as an explicit desktop display language alongside `system`, `zhCn`, and `en` in the symmetric Rust/TypeScript settings contract.
- Resolve Japanese OS locales to Japanese when “Follow System” is selected, while keeping English as the fallback for unsupported locales.
- Provide complete Japanese copy for every desktop window and user-facing native Rust message covered by the application language, including locale-correct date and number formatting.
- Add Japanese homepage and changelog routes under `/ja/`, with a three-language navigation control shared by Chinese, English, and Japanese pages.
- Extend canonical, `hreflang`, Open Graph, JSON-LD, sitemap-visible static routes, website tests, and `llms.txt` product facts to declare Japanese support without changing `/en/` as the stable `x-default` and root redirect destination.
- Add contract and content checks that fail when Japanese is omitted from supported-language resolution, application translations, public routes, or SEO alternates.
- Keep `mclip-cli` command/help output, installer diagnostics, and full README translation out of scope; their language-support facts may be updated, but they remain English-first surfaces.

## Capabilities

### New Capabilities

- `desktop-localization`: Defines the supported application-language contract, system-locale resolution, complete Japanese desktop/native presentation, locale-aware formatting, fallback behavior, and regression coverage.
- `website-localization`: Defines Japanese public routes, three-language navigation, localized product/release content, SEO alternates and structured data, stable default routing, and public-content regression coverage.

### Modified Capabilities

None.

## Impact

- Frontend language contracts and normalization in `src/types.ts`, `src/utils/language.ts`, `src/utils/settings.ts`, and `src/constants.ts`.
- Desktop translation ownership in `src/i18n.ts` (or language-specific modules extracted from it), all translation consumers, Preferences language selection, and locale-sensitive formatting.
- Rust settings serialization/resolution and native localized messages in `src-tauri/src/settings.rs`, tray setup, and history/error presentation.
- Astro routes and shared components under `site/src/`, SEO/structured-data logic, public `llms.txt`, and website tests.
- TypeScript, Rust, frontend-contract, and website-content tests; no new runtime service or network dependency is required.
