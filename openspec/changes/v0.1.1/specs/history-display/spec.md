# history-display Specification

## ADDED Requirements

### Requirement: Configurable Main Window Item Count

The system SHALL let users configure how many copied history items appear in the main window.

#### Scenario: Default main item count

- **GIVEN** no saved main item count exists
- **WHEN** settings are loaded
- **THEN** `mainWindowItemCount` is `10`.

#### Scenario: Adjusted main item count

- **GIVEN** `mainWindowItemCount` is `8`
- **AND** there are at least 20 filtered history items
- **WHEN** the main window renders
- **THEN** it displays positions `1` through `8` in the main list
- **AND** archive groups start at position `9`.

#### Scenario: Main item count is clamped

- **GIVEN** a saved `mainWindowItemCount` outside `5..=20`
- **WHEN** settings are loaded
- **THEN** the value is clamped into `5..=20`.

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
