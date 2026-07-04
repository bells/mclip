## Context

The main window header currently renders a fixed brand block made of the app icon and `mclip` text before the search field. Preferences already has a General tab with binary display settings such as row number visibility, and the app settings contract is mirrored across TypeScript defaults/normalization and Rust defaults/sanitization.

This change adds one more user-facing display preference. It should keep the current branded header as the default while allowing users to hide the whole brand block for a more compact search-first layout.

## Goals / Non-Goals

**Goals:**

- Add a persisted setting that controls whether the main-window header brand block is shown.
- Expose the setting in Preferences > General as an immediate-apply toggle.
- Keep Rust `AppSettings` and TypeScript `AppSettings` symmetric, including defaults and legacy/missing-setting behavior.
- Make the hidden-brand layout reclaim header space for search without leaving an empty logo column.
- Keep Chinese and English preference copy aligned.

**Non-Goals:**

- Changing tray/menu bar icon behavior or icon style settings.
- Removing the app icon from About, Preferences, installers, or release assets.
- Adding multiple header layout modes or custom branding.
- Reworking the main-window preview model, row density, or search behavior.

## Decisions

1. Store the preference as `showMainWindowBrand: boolean`.

   The user-facing label can say "Show logo" because that is the visible control users recognize, but the persisted field should describe the actual behavior: the whole main header brand block, including logo and `mclip` text, is shown or hidden. This is clearer than `showLogo`, which could be mistaken for tray, About, or installer icon behavior.

   Alternative considered: reuse or extend `menuBarIconStyle`. That setting only controls the native tray/menu bar asset and should remain independent from the React main-window header.

2. Default and sanitize to `true`.

   Existing users should see no visual change after upgrade, and missing/legacy settings files should normalize to the current behavior. Frontend `DEFAULT_SETTINGS`/`normalizeSettings` and backend `AppSettings::default`/`sanitize` must all preserve `false` and fill missing values as `true`.

   Alternative considered: default hidden to maximize search space. That would surprise existing users and weaken the app identity without an explicit user action.

3. Pass a render prop into `AppHeader`.

   The main app state already owns normalized settings, and `AppHeader` is a focused render component. Passing something like `showBrand={settings.showMainWindowBrand}` keeps `AppHeader` presentational and avoids having it read settings itself.

   Alternative considered: conditionally render a separate header variant in the parent. That would duplicate search markup and increase the chance of keyboard/focus behavior drifting between variants.

4. Use the existing immediate-save Preferences pattern.

   Preferences should add a General-tab toggle near the other display choices and update settings via the existing `applySettingsPatch` flow. This keeps save queuing, rollback on save failure, and `settings-updated` synchronization behavior consistent with current preferences.

   Alternative considered: add an Apply button for this setting. The Preferences window currently applies changes immediately, so introducing a separate apply mode would be inconsistent.

## Risks / Trade-offs

- [Risk] A new setting field is added only on one side of the Rust/TypeScript contract. -> Mitigation: update `src/types.ts`, `src/constants.ts`, `src/utils/settings.ts`, and `src-tauri/src/settings.rs` together, then run the repo-native checks.
- [Risk] Hiding the brand leaves unused header space or causes the search input to shift awkwardly. -> Mitigation: conditionally omit the brand element and adjust header/search styles so the search shell flexes into the available width.
- [Risk] The setting label says "logo" while the behavior hides both logo and app name. -> Mitigation: use helper text or concise translations that state the main-window logo/name area is controlled, without adding instructional noise.
- [Risk] Existing settings files lack the new field. -> Mitigation: default missing values to `true` in both frontend normalization and backend sanitization.

## Migration Plan

1. Add `showMainWindowBrand` to the TypeScript and Rust settings models with default `true`.
2. Update settings normalization/sanitization so older settings files load safely and explicit `false` persists.
3. Add the Preferences > General toggle with Chinese and English copy.
4. Thread the normalized setting into `AppHeader` and conditionally render the brand block.
5. Add focused regression coverage for settings defaults/normalization and header rendering or behavior.
6. Verify with `npm run check:frontend` or `npm run check`; use `git diff --check` for whitespace-sensitive docs/spec changes.

Rollback is straightforward: remove the toggle and field usage, leaving missing persisted values harmless. If a released version has already written `showMainWindowBrand`, older builds should ignore the extra JSON field.

## Open Questions

- None. The requested behavior is scoped to the main-window header brand block shown to the left of search.
