# v0.1.1 Design

## Settings Contract

Add these fields to the cross-boundary `AppSettings` contract:

- `mainWindowItemCount: number`
- `historyGroupItemCount: number`
- `showHistoryItemNumbers: boolean`
- `appearanceTheme: "system" | "light" | "dark"`

Rust keeps the serialized names camelCase with `serde(rename_all = "camelCase")`; TypeScript mirrors the same field names in `src/types.ts`. Defaults live in both `DEFAULT_SETTINGS` and `AppSettings::default()`.

Validation should be symmetric:

- `mainWindowItemCount` clamps to `5..=maxHistoryCount`;
- `historyGroupItemCount` keeps the compact archive-preview range of `5..=20`;
- `showHistoryItemNumbers` defaults to `true`;
- unknown themes normalize to `system`;
- legacy settings files without these fields continue loading.

Sanitization order matters: normalize `maxHistoryCount` first, then clamp
`mainWindowItemCount` against that sanitized value. When Preferences lowers
`maxHistoryCount` below the current `mainWindowItemCount`, the UI should save or
render the reconciled main count immediately so the stepper/input never advertises
an impossible value.

## History Sizing Model

The current `HISTORY_GROUP_SIZE` represents two different concepts. v0.1.1 should split them:

- `mainWindowItemCount` controls how many filtered history entries appear in the main window.
- `historyGroupItemCount` controls the size of each archive group after the main window slice.

Example with `mainWindowItemCount = 8` and `historyGroupItemCount = 12`:

- main list shows positions `1..8`;
- first archive group shows `9 - 20`;
- second archive group shows `21 - 32`.

Do not compute archive slices with `groupIndex * groupSize` after this change. `HistoryGroupInfo` should either carry slice boundaries or the utility should derive archive items from `startPosition` and `endPosition`. This keeps preview payloads correct when the two counts differ.

`adjust_window_height(item_count, group_count)` can keep the same Rust signature
if the frontend continues passing `visibleHistory.length` and
`historyGroups.length`, but the calculation should treat the result as a desired
height, not an unconditional final height. The final Tauri window height must be
capped to the current monitor work area so a large `mainWindowItemCount` cannot
push the window above the macOS menu bar/status area or below the screen edge.
Rust tests should cover custom item counts, max-height clamping, and monitor
work-area bounds.

## Main Window Scrolling

Large main-window counts should not make the transparent root scroll. Keep the
outer app frame and panel clipped and move scrolling into a dedicated content
region between the header and footer.

Recommended structure:

- header/search stays `flex-shrink: 0`;
- a middle scroll region uses `flex: 1`, `min-height: 0`, and `overflow-y: auto`;
- the main `HistoryList` and `HistoryGroupNav` live inside that scroll region;
- footer actions stay outside the scroll region and remain `flex-shrink: 0`.

This preserves the tray utility feel while allowing `mainWindowItemCount` to
scale up to `maxHistoryCount`. It also prevents the screenshot failure mode where
the window extends under the menu bar and the footer only shows the first action.

Keyboard navigation should continue to call `scrollIntoView({ block: "nearest" })`
on `[data-main-keyboard-target]` elements. With a real scroll container, this
should scroll only the middle region while keeping the header and footer visible.
Preview anchor calculation can keep using `getBoundingClientRect().top` because
the visible row top remains in viewport coordinates after scrolling.

## Row Numbers

`showHistoryItemNumbers` controls only row-leading indices:

- `.app-item-index` in the main list;
- `.app-history-preview-index` in archive preview rows.

When hidden, layout should switch to a no-index grid rather than leaving an empty leading column. Keyboard navigation target ids and absolute `item.position` values remain unchanged. Detail headers may continue showing the item position because that is metadata, not the row-leading number requested here.

## Themes

Use one theme attribute on the document root or app root:

- `data-app-theme="light"`
- `data-app-theme="dark"`

When the setting is `system`, resolve with `prefers-color-scheme` and subscribe to changes while the app is open. Theme application must cover all Tauri-rendered windows because main, preview, preview-detail, About, and Preferences load the same frontend entry.

The visual direction should remain a compact desktop utility:

- restrained surfaces and strong readable contrast;
- no marketing-page hero styling;
- no one-hue palette;
- light theme should feel native and clear, not beige or washed out;
- dark theme should keep the existing mclip personality but move color values into tokens.

## Light Theme Readability

Physical scene: a user opens the menu-bar window over a bright or detailed
desktop wallpaper while still focused on another task. The light theme must read
as a compact utility surface, not as translucent paper laid over the wallpaper.

Use a restrained product color strategy:

- neutral surfaces carry most of the interface;
- teal remains the primary interaction and selection accent;
- amber remains a secondary warm accent for narrow hierarchy moments;
- semantic state colors stay reserved for danger, warning, success, and info;
- no additional theme families are introduced.

The screenshot evidence for this pass shows two concrete weak spots:

- main-list row-leading numbers are too pale in light mode;
- detail metadata labels such as source app, first copied time, last copied
  time, and copy count are too pale on the light preview panel.

The likely root cause is token reuse from the dark theme, especially raw
`rgba(244, 184, 96, ...)` accent colors whose alpha works on dark surfaces but
does not hold enough contrast on near-white translucent panels. The fix should
not be a one-off color override for the screenshot. Introduce or refine semantic
tokens for the light theme and apply them consistently.

Recommended token roles:

- `--app-ink`: primary readable text.
- `--app-ink-soft`: secondary row text and non-primary labels.
- `--app-ink-dim`: tertiary hints that still meet body-text contrast when used
  for readable copy.
- `--app-index-ink`: row-leading numbers in main and archive preview lists.
- `--app-meta-label-ink`: detail metadata labels.
- `--app-accent`: primary action or important warm accent.
- `--app-accent-cool`: selected, focused, and current navigation accent.
- `--app-surface`, `--app-surface-raised`, and `--app-surface-translucent`:
  explicit light surfaces that are opaque enough to protect text from wallpaper
  bleed-through.
- `--app-line` and `--app-line-strong`: borders with at least 3:1 contrast for
  UI component boundaries when the boundary conveys structure.

Existing token names may be reused where they already express the correct role.
If a selector currently uses a raw RGBA accent for readable text, prefer moving
that value behind a semantic token. This keeps future dark and light tuning from
diverging selector by selector.

Contrast targets:

- normal readable text in rows, menu labels, settings descriptions, placeholders,
  preview content, and modal copy should meet WCAG AA 4.5:1 against its local
  surface;
- bold or large UI labels, row-leading numbers, metadata labels, and icons that
  communicate structure should meet at least 3:1, with 4.5:1 preferred when the
  label carries important content;
- focus rings, selected rows, switches, check marks, and delete controls should
  meet at least 3:1 as UI components;
- selected and hover states must remain readable without relying on color alone.

Light theme surfaces should move away from the current washed-out cream feeling.
Use either a true neutral off-white or a very small teal-tinted neutral that
belongs to the mclip palette. Avoid generic warm beige as the base. Preserve the
transparent-window feel with controlled opacity and subtle panel depth, but do
not allow wallpaper detail to compete with text.

Implementation should audit these selectors at minimum:

- `.app-item-index`
- `.app-history-preview-index`
- `.app-history-detail-meta dt`
- `.app-history-preview-kicker`
- `.app-modal-version`
- `.app-settings-group-label`
- `.app-settings-note`
- `.app-menu-hint`
- `.app-search::placeholder`
- light-theme selected, hover, and focus selectors for main rows, archive rows,
  preview rows, settings tabs, switches, and buttons.

Because screenshots alone cannot prove full accessibility compliance, add a
lightweight contrast regression test for named theme tokens and manually inspect
the rendered app in light mode over a busy desktop background. The manual pass
should cover the main window, group preview, item detail preview,
preview-detail, About, Preferences, and clear-history modal.

## Dialog Status Bar

About and Preferences should share a top status/title bar component. The bar
should feel closer to the ztool reference screenshots: a native-like dialog
chrome strip attached to the top of the window, not a centered pill inside the
content.

The bar should include:

- window controls;
- window title;
- `data-dialog-drag-region` on the draggable area.

Visual and layout direction:

- the title bar spans the full dialog width and is flush with the top rounded
  panel edge;
- use a neutral title-bar surface with a subtle bottom separator in light theme
  and corresponding dark theme tokens in dark mode;
- remove the decorative bottom grabber line from dialog status bars;
- on macOS, place controls on the left in close/minimize/maximize order and put
  the title on the same baseline after the controls, matching the reference
  rhythm of "About ZTool" and "ZTool Preferences";
- on Windows or other platforms, keep the control cluster on the conventional
  side already chosen by `DialogWindowControls`;
- if minimize and maximize remain unsupported for these fixed-size dialogs,
  render them as disabled or unavailable controls while preserving the
  three-dot title-bar rhythm;
- title text should identify both app and window purpose, such as
  `mclip Preferences` and `About mclip`, with localized strings updated when
  user-facing copy changes.

`DialogWindowFrame` should only call `startCurrentWindowDrag()` when the event target is inside `[data-dialog-drag-region]` and outside known interactive controls. This replaces the current broad "any non-interactive dialog content can drag" behavior.

Implementation should keep this refinement localized to the shared dialog
chrome components and CSS:

- update `DialogStatusBar` markup so the title and controls participate in the
  same title-bar layout instead of relying on a centered title with absolutely
  positioned controls;
- keep `DialogWindowControls` as the single owner of control order, labels, and
  enabled/disabled semantics;
- adjust `.app-dialog-panel`, `.app-dialog-statusbar`, `.app-window-controls`,
  `.app-window-control`, and `.app-modal-title` styles in `src/App.css`;
- verify the content padding in `AboutWindow` and `PreferencesWindow` so their
  first content row does not visually collide with the taller title bar.

## macOS Template Menu Bar Icon

Keep `MenuBarIconStyle.Light` / `menuBarIconStyle: "light"` for compatibility. On macOS, after setting the tray icon image, mark the underlying `NSImage` as a template image when the style is `Light`. This lets macOS adapt the icon to light/dark menu bar states and wallpaper contrast.

On Windows, keep using the existing image asset path because template images are a macOS AppKit concept.

## Color Codes And Emoji

Do not change `HistoryEntry` persistence for this feature. Add a frontend-only text classifier, likely under `src/utils/historyDisplay.ts`, that recognizes:

- hex colors: `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`;
- CSS rgb/rgba colors with valid numeric ranges;
- short emoji-only text using Unicode emoji segmentation.

Rendering rules:

- main rows can show a compact swatch or emoji mark before the text;
- detail preview can show a larger swatch, the original code, and the copied text;
- invalid or ambiguous text falls back to normal text display;
- selecting the item still copies the original text exactly.

## CLI

`mclip-cli --help`, `mclip-cli -h`, and `mclip-cli help` should print usage and exit `0` without requiring a readable history file. `mclip-cli --version`, `mclip-cli -V`, and `mclip-cli version` should print the package version and exit `0` without reading history.

Command-level help should remain supported, but it should not require history loading when possible. Unknown commands still exit with usage error code `2`.

The public installer should prefer prebuilt release binaries:

1. detect OS and CPU architecture;
2. build a release asset URL for the requested version or latest version;
3. download to a temp file;
4. install to the user-level bin directory;
5. chmod on Unix;
6. print PATH guidance.

Source build remains available when `MCLIP_CLI_SOURCE` is set, a local repo is detected, or a development flag requests source fallback. Public one-command install should not require Rust, Cargo, or Git for supported platforms.

## Verification Strategy

Fast checks:

```bash
npm run check:frontend
node --test tests/*.test.mjs
git diff --check
```

Rust and CLI checks:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
npm run cli:test
```

Full gate before implementation is considered complete:

```bash
npm run check
```

For visual implementation, run the app and inspect main, preview, About, and Preferences in light, dark, and system mode.
