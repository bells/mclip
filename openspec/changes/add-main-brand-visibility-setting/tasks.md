## 1. Settings Contract

- [x] 1.1 Add `showMainWindowBrand` to the TypeScript `AppSettings` interface and `DEFAULT_SETTINGS` with a default value of `true`.
- [x] 1.2 Update frontend settings normalization so missing values become `true` while an explicit `false` value is preserved.
- [x] 1.3 Add `show_main_window_brand` to Rust `AppSettings`, keep serde camelCase output as `showMainWindowBrand`, and default it to `true`.
- [x] 1.4 Update Rust settings sanitization so legacy settings files load safely and explicit disabled values persist.

## 2. Preferences UI

- [x] 2.1 Add Chinese and English preference copy for the main-window brand visibility setting.
- [x] 2.2 Add a Preferences > General toggle that uses the existing immediate-save settings patch flow.
- [x] 2.3 Place the toggle with the other display-oriented General settings without changing the tab model or dialog chrome behavior.

## 3. Main Header Rendering

- [x] 3.1 Pass the normalized setting from the main app state into `AppHeader`.
- [x] 3.2 Update `AppHeader` to conditionally render the full brand block while keeping search input behavior, focus handling, and keyboard target data unchanged.
- [x] 3.3 Adjust header/search layout styles so hiding the brand lets the search field use the freed space without leaving an empty column.

## 4. Regression Coverage

- [x] 4.1 Add or update frontend tests for settings normalization defaults and explicit `false` preservation.
- [x] 4.2 Add or update Rust tests for settings default/sanitize behavior if existing settings tests cover persisted fields.
- [x] 4.3 Add a focused render or behavior test for the main header showing and hiding the brand when the setting changes, if the current test setup supports component-level coverage.

## 5. Verification

- [x] 5.1 Run `npm run check:frontend`.
- [x] 5.2 Run `npm run check`.
- [x] 5.3 Run `git diff --check`.
- [x] 5.4 Visually smoke test the main window with the setting enabled and disabled, including Chinese and English Preferences copy.
