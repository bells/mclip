## 1. Settings Contract and Compatibility

- [x] 1.1 Add focused failing Rust and Node contract tests for `textQuickActions` defaults, camelCase serialization, nested normalization, invalid/missing fields, and legacy settings files.
- [x] 1.2 Add Rust `TextQuickActionSettings` and `AppSettings.text_quick_actions` with serde defaults, all-enabled defaults, sanitize behavior, and round-trip coverage.
- [x] 1.3 Add the symmetric TypeScript `TextQuickActionSettings` and `AppSettings.textQuickActions` types without `any`.
- [x] 1.4 Extend `DEFAULT_SETTINGS` and frontend `normalizeSettings` to merge the nested JSON, Base64, and URL component booleans independently.
- [x] 1.5 Audit every direct Rust/TypeScript `AppSettings` initializer, fixture, IPC mock, and settings snapshot so the new field is present or compatibility-defaulted.

## 2. Navigation, Search, and Save Foundations

- [x] 2.1 Add typed Preferences destination and setting descriptor models with stable destination IDs, setting IDs, focus target IDs, paths, and allowlisted aliases.
- [x] 2.2 Implement pure creation and filtering helpers for the six-page localized metadata index without indexing values, source IDs, paths, clipboard content, or errors.
- [x] 2.3 Add unit coverage for destination order, navigation groups, Chinese and English search, case/whitespace normalization, empty results, private-value exclusion, and descriptor/rendered-ID parity.
- [x] 2.4 Extract the queued immediate-save behavior into a typed preference save controller with optimistic state, sequential snapshots, global revision protection, settings-event echo handling, and keyed feedback.
- [x] 2.5 Add save-controller tests for success, rapid edits, stale responses, latest-failure rollback, row-level errors, and non-blocking unrelated controls.

## 3. Shared Settings Center Components

- [x] 3.1 Build an accessible two-column `PreferencesSettingsCenter` shell with sidebar search, `mclip` and Tools navigation groups, active destination state, and a scrollable content column.
- [x] 3.2 Build shared page-header, group, row, switch, select/listbox, numeric-field, status, and action components with label/description associations and visible keyboard focus.
- [x] 3.3 Implement search-result activation that selects the destination, waits for render, scrolls the setting into view, and focuses its primary control.
- [x] 3.4 Implement `Escape` precedence so nested controls handle it first, non-empty search clears and refocuses, and empty search retains the existing hide-window behavior.
- [x] 3.5 Keep `PreferencesWindow` responsible for window lifecycle, settings/platform data, and action orchestration while moving navigation and page rendering out of the monolithic component.

## 4. Page Reorganization

- [x] 4.1 Build the General page with language, launch at login, auto paste, macOS permission status/actions, and immediate non-blocking feedback.
- [x] 4.2 Build the Appearance page with theme, menu bar icon, main-window brand, and row-number settings in Interface and Main Window groups.
- [x] 4.3 Build the History page with saved types, maximum history count, main-window item count, and archive-group item count while preserving numeric intermediate states and all current bounds.
- [x] 4.4 Build the Privacy page with masking disclosure, source capability/status, exact ignored-source management, and explicit legacy reclassification without a master privacy switch.
- [x] 4.5 Build the Text Actions page with independent JSON, Base64, and URL component switches and copy explaining local execution and desktop-only visibility.
- [x] 4.6 Move existing version state, install/upgrade/reinstall actions, install command, integrity errors, and PATH guidance into the Agent CLI page without changing its command contract.
- [x] 4.7 Add complete Chinese and English page titles, descriptions, group labels, search metadata, switch labels, save states, empty search, and error text.

## 5. Desktop Text Action Enforcement

- [x] 5.1 Add a pure, exhaustively typed action-to-group mapping and filter helper for the six existing `TextTransformAction` values.
- [x] 5.2 Extend item and group preview payloads with `textQuickActions`, update every constructor/reconciler, and preserve the field when deriving archive-group preview-detail payloads.
- [x] 5.3 Pass text-action settings through `HistoryDetailPanel` into `TextQuickActions` for single-item and group-detail surfaces.
- [x] 5.4 Skip applicability IPC and hide the section when all groups are disabled; otherwise filter applicable actions by enabled group without changing Rust transformations.
- [x] 5.5 Verify masked sensitive text still requires explicit reveal before any enabled action receives original content, and verify disabled desktop groups do not affect CLI `transform`.

## 6. Visual System and Native Window

- [x] 6.1 Replace top-tab styles with the compact two-column layout, approximately 220-pixel sidebar, restrained settings cards/rows, right-aligned controls, and a semantic active accent rail.
- [x] 6.2 Use existing light/dark semantic tokens for sidebar, content, focus, selection, status, and errors; add only necessary tokens and retain contrast thresholds and mclip color roles.
- [x] 6.3 Keep the custom status bar, platform-preferred control order, transparent rounded clipping, and drag exclusion for all sidebar/content interactions.
- [x] 6.4 Update the `preferences` auxiliary descriptor and contract tests to a fixed logical size of approximately 820×600 while preserving lazy creation, focusability, and disabled minimize/maximize UI.
- [x] 6.5 Verify long bilingual copy, source identifiers, CLI paths, status/error text, and content overflow remain readable without moving the sidebar search or status bar.

## 7. Regression and Platform Verification

- [x] 7.1 Replace brittle Preferences source-shape assertions with behavior/data-contract coverage while retaining immediate-save, privacy disclosure, theme, dialog-drag, auxiliary-ready, and CLI-install regressions.
- [x] 7.2 Run `cargo fmt --manifest-path src-tauri/Cargo.toml` and `npm run check`.
- [x] 7.3 Run `node --test tests/*.test.mjs` and `npm run cli:test` to cover frontend contracts and unchanged CLI behavior.
- [x] 7.4 Run `openspec validate optimize-preferences-settings-center --type change --strict` and `git diff --check`, then audit that only this change and intended implementation files are staged or reported.
- [ ] 7.5 On macOS, smoke Preferences creation/reopen, both themes, all destinations, Chinese/English search-to-focus, rapid immediate saves, privacy actions, text-action filtering, keyboard Escape, window drag, and 820×600 work-area fit.
- [ ] 7.6 On Windows, smoke the native Preferences frame, platform-side controls, scrolling, search/focus, immediate saves, text-action filtering, source-capability messaging, and common 1366×768 work-area fit; do not infer this result from macOS or cross-target checks.
