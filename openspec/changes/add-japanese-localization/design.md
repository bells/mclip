## Context

The desktop application currently models language twice across the Tauri boundary: TypeScript exposes `AppLanguage = "system" | "zhCn" | "en"`, while Rust persists the matching `AppLanguage::{System, ZhCn, En}` enum and resolves native messages through `ResolvedAppLanguage`. The frontend translation catalog is a single `src/i18n.ts` object, system-locale resolution treats every non-Chinese locale as English, and one timestamp formatter contains a direct Chinese-versus-English branch.

The Astro site has separate Chinese and English home/changelog pages, but its layout, Hero, footer, SEO metadata, structured data, and tests assume exactly two locales through binary branches. The root route deliberately redirects to `/en/`, which is also the `x-default` page.

This change crosses the persisted settings contract, React and Rust presentation, all Tauri windows, Astro static routes, and public metadata. It must preserve immediate-save Preferences behavior, compact fixed-size desktop windows, exact clipboard content, and English fallback for unsupported OS locales. It must not add a translation service or a runtime network dependency.

## Goals / Non-Goals

**Goals:**

- Add Japanese as the third complete language for the desktop application and public website.
- Keep Rust serialization, TypeScript types, normalization, and system-locale resolution symmetric around the stable identifier `ja`.
- Make missing Japanese desktop keys a build-time error and make locale-sensitive formatting use one explicit mapping.
- Keep Japanese coverage complete across all seven Tauri windows, shared dialogs, and existing language-aware native messages.
- Publish first-class `/ja/` and `/ja/changelog/` pages with correct navigation, canonical metadata, alternates, Open Graph locale data, JSON-LD, and public product facts.
- Preserve current Chinese and English behavior and provide focused automated and runtime verification.

**Non-Goals:**

- Localizing `mclip-cli` help, command output, installer diagnostics, source-code documentation, or the full README.
- Translating clipboard contents, file paths, source-application names, command names, product names, or standard technical tokens such as JSON and Base64.
- Adding browser-language redirects, geolocation, a translation CMS, remote translation APIs, or a third-party runtime i18n framework.
- Adding Spanish, German, Korean, or additional locale variants in this change.
- Changing the website root redirect or `x-default` away from English.

## Decisions

### 1. Japanese uses one stable `ja` product identifier

Both persisted desktop settings and the TypeScript IPC contract will use `ja`. Rust adds `Ja` to `AppLanguage` and `ResolvedAppLanguage`; serde's existing camel-case representation produces `"ja"`. The website uses `/ja/`, HTML `lang="ja"`, BCP 47 formatting locale `ja-JP`, and Open Graph locale `ja_JP`.

Using `ja` avoids inventing an application-only alias and correctly covers Japanese system locale variants such as `ja`, `ja-JP`, and case/encoding suffixes after normalization. A region-specific persisted value such as `jaJp` was rejected because there is no product requirement for separate Japanese regional dictionaries.

### 2. Keep the existing static-dictionary architecture, but give each language a parity-checked module

The current translation catalog is already local, deterministic, typed, and adequate for three languages. Adding i18next or another runtime framework would increase bundle and migration cost without a need for runtime catalog loading, namespaces, or complex Japanese plural rules.

The monolithic catalog should be split into a small index plus `en`, `zhCn`, and `ja` dictionary modules. The English dictionary defines a recursively widened `AppTranslations` shape: string leaves become `string`, translation callbacks preserve their argument lists and return `string`, and nested keys remain required. Chinese and Japanese dictionaries must `satisfy` that shape. The index maps every `ResolvedAppLanguage` to a complete dictionary and retains English as the defensive runtime fallback.

This structure is preferred over copying a third large object into `src/i18n.ts`, because per-language ownership makes review practical while compile-time shape checking prevents a new or existing key from silently falling through. Translation values remain authored static text; user-supplied clipboard data is never passed through translation logic.

### 3. Resolve and format locales through shared exhaustive mappings

The TypeScript and Rust pure resolvers will both recognize normalized locales beginning with `zh` as Chinese and `ja` as Japanese, with English for every other OS locale. Explicit `zhCn`, `en`, or `ja` settings bypass system detection.

TypeScript will expose a single exhaustive mapping from `ResolvedAppLanguage` to `zh-CN`, `en-US`, or `ja-JP` for `Intl.DateTimeFormat` and number formatting. Existing binary locale branches and hard-coded display locales on language-sensitive surfaces will use that helper. Rust exhaustive matches will add Japanese messages for the tray tooltip and existing localized history command errors.

For forward compatibility, the new Rust persisted enum should deserialize an unknown language value as `System` instead of invalidating unrelated settings; frontend normalization already returns its default for unsupported values. This does not make rollback perfectly symmetric: an older binary that predates `ja` may reset settings after a user has selected Japanese, but history data remains unaffected.

### 4. Update every open window through the existing settings event

Japanese remains an ordinary `AppLanguage` value in `AppSettings`; no parallel language state or window-specific preference will be introduced. Preferences continues to save immediately, the existing `settings-updated` event refreshes language state, and payloads sent to auxiliary windows continue to carry `language` through the symmetric IPC types.

The implementation audit covers `main`, `preview`, `preview-detail`, `image-viewer`, `about`, `quick-action`, and `preferences`, plus shared modals and window controls. Fixed window sizes are retained unless Japanese runtime smoke demonstrates clipping; any necessary adjustment must be the smallest shared size/token change and must preserve the tray-first compact layout.

### 5. Model website locales as data instead of adding a third branch to binary ternaries

The site will define a closed locale descriptor map for `zh`, `en`, and `ja`, containing the path segment, HTML language, label, BCP 47/OG locale values, and route helpers. `SiteLayout`, Hero, footer, and a shared language navigation component consume the map rather than nested ternaries. Home and changelog body copy remain explicit per-locale page files so technical claims and release caveats can be reviewed as complete documents.

Alternate URLs are generated by replacing only the leading locale segment while preserving the page suffix, so a changelog links to all three changelogs rather than homepages. `/en/` remains both the temporary root redirect destination and `x-default`. Open Graph emits the current locale plus both alternatives, JSON-LD declares all three website languages and the current page language, and Astro's static route discovery adds Japanese pages to the sitemap.

### 6. Treat language support as a cross-surface contract

Tests will cover TypeScript and Rust locale resolution, settings normalization/serialization, translation-shape completeness, Japanese Preferences selection, and Japanese date formatting. Existing frontend contract tests will be extended where they currently encode the two-language union.

Website content tests will load Chinese, English, and Japanese home/changelog pages; verify core product, installation, privacy, signing, and version facts; verify three-way navigation and same-page alternates; and assert `hreflang`, Open Graph, JSON-LD, and `llms.txt` declarations. A macOS development/runtime smoke will select Japanese and inspect all window families for untranslated UI, overflow, and immediate propagation. Windows compile/CI remains required, while a local macOS smoke is not presented as Windows runtime proof.

## Risks / Trade-offs

- [Japanese copy is complete structurally but unnatural or technically inaccurate] → Maintain a small terminology glossary during implementation, preserve product/command tokens, test critical trust statements, and perform a human-language review before release.
- [A new translation key is added to only one language later] → Make every locale module satisfy the same recursive translation contract and keep a key-parity regression test for any runtime-loaded representation.
- [Binary Chinese/English assumptions remain outside the main catalog] → Search exhaustively for language comparisons, hard-coded locales, and `ResolvedAppLanguage` matches in both Rust and TypeScript; make enum matches exhaustive.
- [Japanese text clips fixed-size utility windows] → Run all-window Japanese smoke at normal and enlarged text settings, prefer copy refinement/wrapping, and change shared window dimensions only when necessary.
- [Website language links point to the wrong page kind] → Generate alternates from a locale-neutral suffix and test both home and changelog routes for all three languages.
- [Downgrading after persisting `ja` is not understood by an older binary] → Document the rollback limitation; rollback can reset the language to `system` or remove only the language setting, and it must not touch `history.json`.
- [Scope expands into CLI localization] → Limit implementation to language-support facts for CLI/public docs; keep command/help/output behavior unchanged and call that boundary out in release notes.

## Migration Plan

1. Add the symmetric `ja` language variants, forward-compatible normalization, resolver tests, and locale mapping without changing the default language.
2. Split and type-check the translation dictionaries, add complete Japanese desktop/native copy, and update every direct language branch.
3. Add Japanese site routes and locale descriptors, then update shared navigation, SEO, structured data, public facts, and content tests.
4. Run frontend, Rust, root contract, site, and strict OpenSpec gates; perform Japanese macOS all-window smoke and use CI/Windows checks for cross-target confidence.
5. Release additively. Existing `system`, `zhCn`, and `en` settings remain valid; Japanese OS users on `system` begin seeing Japanese after upgrade.

Rollback requires reverting the application/site build. If `settings.json` already contains `"language": "ja"`, set it to `"system"`, `"zhCn"`, or `"en"` before launching a pre-change binary, or allow that older binary to recreate settings. Clipboard history and assets require no migration or rollback.

## Open Questions

None. Japanese is selected as the next product language for this change; later language prioritization should use actual download, site-traffic, and support-demand evidence gathered after release.
