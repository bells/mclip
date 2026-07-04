## Why

Some users prefer the main tray window to spend its limited header space on search rather than the app brand block. The current header always shows the app icon and `mclip` text to the left of the search box, so there is no way to opt into a more compact search-first layout.

## What Changes

- Add a Preferences > General setting that controls whether the main-window brand block is shown.
- Keep the app logo and `mclip` text visible by default for existing and first-time users.
- When the setting is disabled, hide the whole brand block to the left of the search field and let the search control use the freed header space.
- Persist the setting in the existing app settings model and keep frontend normalization and backend sanitization aligned.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `appearance-settings`: Add a user-facing main-window brand visibility setting.

## Impact

- Frontend settings contract in `src/types.ts`, defaults in `src/constants.ts`, and normalization in `src/utils/settings.ts`.
- Rust settings contract, defaults, and sanitization in `src-tauri/src/settings.rs`.
- Preferences UI and i18n copy for the General tab in `src/components/PreferencesWindow.tsx` and `src/i18n.ts`.
- Main-window header rendering in `src/components/AppHeader.tsx`, its call site, and any layout styles needed for the search field when the brand is hidden.
- Regression coverage for default behavior, persisted false values, and main header rendering.
