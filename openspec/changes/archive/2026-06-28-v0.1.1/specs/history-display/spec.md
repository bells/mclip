# history-display Specification

## ADDED Requirements

### Requirement: Configurable Main Window Item Count

The system SHALL let users configure how many copied history items appear in the main window.

#### Scenario: Default main item count

- **GIVEN** no saved main item count exists
- **WHEN** settings are loaded
- **THEN** `mainWindowItemCount` is `10`.

#### Scenario: Adjusted main item count

- **GIVEN** `maxHistoryCount` is `50`
- **AND** `mainWindowItemCount` is `40`
- **AND** there are at least 50 filtered history items
- **WHEN** the main window renders
- **THEN** it displays positions `1` through `40` in the main list
- **AND** archive groups start at position `41`.

#### Scenario: Main item count upper bound follows maximum history count

- **GIVEN** `maxHistoryCount` is `100`
- **WHEN** the user edits the main window item count in Preferences
- **THEN** the largest accepted `mainWindowItemCount` is `100`.

#### Scenario: Main item count is clamped by maximum history count

- **GIVEN** `maxHistoryCount` is `50`
- **AND** a saved `mainWindowItemCount` outside `5..=50`
- **WHEN** settings are loaded
- **THEN** the value is clamped into `5..=50`.

#### Scenario: Lowering maximum history count reconciles main item count

- **GIVEN** `mainWindowItemCount` is `80`
- **AND** the user lowers `maxHistoryCount` to `50`
- **WHEN** the setting change is saved
- **THEN** `mainWindowItemCount` is reduced to `50`
- **AND** the Preferences control shows `50` as the current main window item count.

### Requirement: Scrollable Main Window Content

The system SHALL keep the main window usable when the configured main item count exceeds the available window height.

#### Scenario: Main list scrolls when configured count is large

- **GIVEN** `mainWindowItemCount` is `80`
- **AND** there are at least 80 filtered history items
- **WHEN** the main window renders on a screen that cannot fit all rows at once
- **THEN** the history content area is vertically scrollable
- **AND** the app header remains fully visible
- **AND** every footer action remains fully visible.

#### Scenario: Main window respects monitor work area

- **GIVEN** the main window is shown from the macOS menu bar or Windows tray
- **AND** the desired content height is larger than the current monitor work area can fit
- **WHEN** the window is positioned and resized
- **THEN** the top edge is not above the monitor work area
- **AND** the bottom edge is not below the monitor work area
- **AND** the search header is not hidden behind the menu bar or status area.

#### Scenario: Keyboard navigation stays visible while scrolling

- **GIVEN** the main history content area is scrollable
- **WHEN** the user moves keyboard focus through history rows, archive group rows, and footer actions
- **THEN** the focused target scrolls into view within the main content area
- **AND** preview windows continue to align to the visible focused or hovered row.

### Requirement: Configurable Archive Group Item Count

The system SHALL let users configure how many copied history items appear in each archive group preview.

#### Scenario: Default archive group item count

- **GIVEN** no saved archive group item count exists
- **WHEN** settings are loaded
- **THEN** `historyGroupItemCount` is `10`.

#### Scenario: Adjusted archive group item count

- **GIVEN** `mainWindowItemCount` is `8`
- **AND** `historyGroupItemCount` is `12`
- **AND** there are at least 32 filtered history items
- **WHEN** archive group navigation renders
- **THEN** the first archive group is labeled `9 - 20`
- **AND** the second archive group is labeled `21 - 32`.

#### Scenario: Archive preview uses configured count

- **GIVEN** `historyGroupItemCount` is `12`
- **WHEN** the user opens an archive group with at least 12 items
- **THEN** the preview window lists 12 copied items.

#### Scenario: Archive group item count is clamped

- **GIVEN** a saved `historyGroupItemCount` outside `5..=20`
- **WHEN** settings are loaded
- **THEN** the value is clamped into `5..=20`.

### Requirement: Color Code Display

The system SHALL visually identify supported color code text entries without changing the stored text.

#### Scenario: Hex color copied

- **GIVEN** a text history item contains `#14b8a6`
- **WHEN** the item appears in a history row or preview
- **THEN** mclip shows a color swatch for that value
- **AND** selecting the item copies `#14b8a6` exactly.

#### Scenario: Invalid color-like text

- **GIVEN** a text history item contains `#12zzzz`
- **WHEN** the item appears in a history row or preview
- **THEN** mclip renders it as normal text without a color swatch.

### Requirement: Emoji Text Display

The system SHALL visually identify short emoji-only text entries without changing the stored text.

#### Scenario: Emoji-only copied text

- **GIVEN** a text history item contains only common emoji characters and whitespace
- **WHEN** the item appears in a history row or preview
- **THEN** mclip shows an emoji-oriented visual treatment
- **AND** selecting the item copies the original text exactly.

#### Scenario: Mixed text and emoji

- **GIVEN** a text history item contains both words and emoji
- **WHEN** the item appears in a history row or preview
- **THEN** mclip renders it as normal text unless it matches a supported emoji-only rule.
