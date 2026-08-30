## 1. Language Contract And Locale Resolution

- [x] 1.1 Extend `ResolvedAppLanguage`/`AppLanguage`, supported-language normalization, default settings, and Preferences language options with the stable `ja` value while preserving `system`, `zhCn`, and `en` serialization.
- [x] 1.2 Add Rust `Ja` variants and exhaustive matches, deserialize unknown persisted language values as `System` without losing unrelated settings, and keep the Rust/TypeScript IPC contract symmetric.
- [x] 1.3 Update the frontend and Rust pure system-locale resolvers so normalized `ja*` locales resolve Japanese, `zh*` remains Chinese, and every unsupported locale remains English.
- [x] 1.4 Add an exhaustive frontend display-locale helper for `zh-CN`, `en-US`, and `ja-JP`; migrate history timestamps and every language-sensitive `Intl`/`toLocaleString` call away from binary language branches.

## 2. Typed Desktop Translation Catalogs

- [x] 2.1 Extract the existing English and Chinese catalogs from the monolithic `src/i18n.ts` into language-owned modules, define a recursively widened `AppTranslations` contract from the canonical English shape, and require every catalog to satisfy it at build time.
- [x] 2.2 Add reviewed Japanese translations for main history/search/footer, groups, previews, detail metadata/actions, sensitive-content states, image viewer, and history confirmation flows while preserving product names, commands, technical tokens, and user data verbatim.
- [x] 2.3 Add reviewed Japanese translations for Preferences navigation/settings/feedback, About/update/diagnostics, quick actions, shared dialog chrome, modals, window controls, and accessible names, including the Japanese language option label.
- [x] 2.4 Keep `getTranslations` as the single catalog lookup, map all resolved languages explicitly, retain a complete English defensive fallback, and add structural/key-parity regression coverage.
- [x] 2.5 Add Japanese Rust copy for the tray tooltip and every existing language-aware history command error, preserving the existing content-free error and privacy contracts.
- [x] 2.6 Audit `src/` and `src-tauri/src/` for direct `zhCn`/`en` comparisons, hard-coded display locales, and exhaustive language matches; update all seven window families and auxiliary payload paths without introducing parallel language state.

## 3. Desktop Behavior And Contract Tests

- [x] 3.1 Add TypeScript tests for Japanese system/explicit resolution, unsupported-locale fallback, Japanese settings normalization, defensive catalog fallback, and `ja-JP` date/number formatting.
- [x] 3.2 Add Rust tests for `"ja"` serde round trips, Japanese system and explicit resolution, unknown persisted-language recovery with unrelated settings intact, and Japanese tray/history error selection.
- [x] 3.3 Extend frontend source/IPC contract tests so the supported-language union, Preferences immediate-save flow, auxiliary-window language payloads, and translation module parity cannot regress to a Chinese/English-only assumption.
- [x] 3.4 Add focused tests proving a language change alters only application presentation and does not mutate canonical text, image, or file-list history/copy behavior.

## 4. Shared Website Locale Architecture

- [x] 4.1 Add a closed `zh`/`en`/`ja` site-locale descriptor and route helpers covering path segment, visible label, HTML/BCP 47 language, Open Graph locale, and equivalent-page alternate URLs.
- [x] 4.2 Add a shared accessible three-language navigation control, use it on homepages and changelogs, preserve the current page kind when switching, and make the control fit narrow viewports without overflowing primary navigation.
- [x] 4.3 Refactor `SiteLayout`, Hero, and footer away from binary locale ternaries to the shared locale model while preserving the existing Chinese and English content and routes.
- [x] 4.4 Generate canonical and `hreflang` metadata for `zh-CN`, `en`, and `ja`, keep equivalent English routes as `x-default`, emit current plus alternate Open Graph locales, and make JSON-LD language fields exhaustive and localized.

## 5. Japanese Website Content And Public Facts

- [x] 5.1 Create `/ja/` with complete Japanese product, workflow, Agent/CLI, installation, FAQ, privacy/masking, signing, and platform copy equivalent in factual scope to the Chinese and English homepages.
- [x] 5.2 Create `/ja/changelog/` with accurate Japanese release notes and the same version, performance-evidence boundaries, privacy caveats, installation verification, macOS notarization, and Windows signing disclosures as the existing changelogs.
- [x] 5.3 Localize Japanese page titles, descriptions, FAQ structured content, video/image accessible text, and social metadata while leaving commands, URLs, version identifiers, and product tokens exact.
- [x] 5.4 Update `site/public/llms.txt`, `README.md`, `AGENTS.md`, and `openspec/project.md` language-support facts for Chinese, English, and Japanese, explicitly retaining English-only CLI help/output and the English root default.

## 6. Website Regression Coverage

- [x] 6.1 Expand website content tests to load all six home/changelog pages and assert Japanese core product, file-restore, installation, privacy, signing, platform, version, and in-development-versus-released facts.
- [x] 6.2 Add tests for three-way home/changelog navigation, active-language accessibility, narrow-layout CSS contracts, canonical/equivalent alternates, `x-default`, Open Graph locale lists, JSON-LD languages, and `llms.txt` Japanese declarations.
- [x] 6.3 Keep the existing temporary `/` to `/en/` redirect test unchanged and verify the production Astro build emits `/ja/`, `/ja/changelog/`, and sitemap entries for all localized routes.
- [x] 6.4 Audit public Japanese copy against a consistent terminology glossary and verify that it never claims localized CLI output, encryption at rest, guaranteed source exclusion, notarization, Windows signing, or unsupported runtime evidence.

## 7. Validation And Runtime Evidence

- [x] 7.1 Run formatting and static gates: `cargo fmt --manifest-path src-tauri/Cargo.toml`, `npm run check`, `node --test tests/*.test.mjs`, and `git diff --check`; resolve every language-contract or catalog-parity failure.
- [x] 7.2 Run website gates with `npm run site:test` and `npm run site:build`, inspect the generated Japanese pages/metadata, and verify the root redirect remains `/en/`.
- [ ] 7.3 Run `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc` and use `windows-2022` CI for compile/test confidence without presenting either as Windows Japanese UI runtime proof.
- [ ] 7.4 On macOS, select Japanese and smoke main, preview, preview-detail, image-viewer, About, quick-action, Preferences, and shared modals for immediate propagation, untranslated application copy, clipping/overflow, keyboard/focus behavior, and exact copy semantics; record macOS-only results and any remaining Windows device gap.
- [x] 7.5 Run `openspec validate add-japanese-localization --type change --strict`, reconcile the implemented behavior with both localization specs, and prepare a release note that states the new Japanese application/site support and the unchanged English-first CLI boundary.
