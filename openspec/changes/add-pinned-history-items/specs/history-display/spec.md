## MODIFIED Requirements

### Requirement: Configurable Main Window Item Count

The system SHALL let users configure how many unpinned copied history items appear in the main window in addition to the bounded pinned section.

#### Scenario: Default main item count

- **GIVEN** no saved main item count exists
- **WHEN** settings are loaded
- **THEN** `mainWindowItemCount` is `10`.

#### Scenario: Adjusted main item count

- **GIVEN** `maxHistoryCount` is `50`
- **AND** `mainWindowItemCount` is `40`
- **AND** there are at least 50 filtered unpinned history items
- **WHEN** the main window renders
- **THEN** it displays all matching pinned items before positions `1` through `40` of the matching unpinned list
- **AND** archive groups start at unpinned position `41`.

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
- **AND** the Preferences control shows `50` as the current main window item count
- **AND** the pinned section is not truncated by that setting.

### Requirement: Configurable Archive Group Item Count

The system SHALL let users configure how many unpinned copied history items appear in each archive group preview; pinned entries SHALL remain outside archive group ranges.

#### Scenario: Default archive group item count

- **GIVEN** no saved archive group item count exists
- **WHEN** settings are loaded
- **THEN** `historyGroupItemCount` is `50`.

#### Scenario: Adjusted archive group item count

- **GIVEN** `mainWindowItemCount` is `8`
- **AND** `historyGroupItemCount` is `12`
- **AND** there are at least 32 filtered unpinned history items
- **WHEN** archive group navigation renders
- **THEN** the first archive group is labeled `9 - 20`
- **AND** the second archive group is labeled `21 - 32`
- **AND** pinned entries do not change those labels.

#### Scenario: Archive preview uses configured count

- **GIVEN** `historyGroupItemCount` is `12`
- **WHEN** the user opens an archive group with at least 12 unpinned items
- **THEN** the preview window lists 12 unpinned copied items
- **AND** no pinned item is duplicated into the archive preview.

#### Scenario: Archive group item count is clamped

- **GIVEN** a saved `historyGroupItemCount` outside `5..=100`
- **WHEN** settings are loaded
- **THEN** the value is clamped into `5..=100`.

## ADDED Requirements

### Requirement: Pinned section interaction
The main window SHALL render matching pins as one compact section before unpinned history and SHALL include that section in visible-order keyboard navigation.

#### Scenario: Keyboard traversal with pins
- **GIVEN** matching pinned and unpinned entries are rendered
- **WHEN** the user traverses history with the keyboard
- **THEN** focus follows pinned rows, unpinned rows, archive groups, and footer actions in visible order
- **AND** the active row scrolls into view
- **AND** previews remain aligned to the active row.

#### Scenario: Archive preview numbering ignores pin offsets
- **GIVEN** pinned entries precede chronological history in canonical order
- **WHEN** an archive group preview renders its unpinned slice
- **THEN** displayed row numbers start at `1` for that group and increase by rendered order
- **AND** pinned entries do not offset those local numbers.

#### Scenario: Search with pins
- **GIVEN** a search query matches pinned and unpinned entries
- **WHEN** results render
- **THEN** matching pins appear first
- **AND** non-matching pins are not shown
- **AND** matching unpinned entries retain chronological order.

#### Scenario: Compact visual boundary between pins and recent history
- **GIVEN** matching pinned and unpinned entries are both rendered
- **WHEN** the main list displays their boundary
- **THEN** one compact divider appears between the final pinned row and the first unpinned row
- **AND** the list does not add section-label text or per-row pin markers
- **AND** no divider appears when the rendered results contain only pinned or only unpinned entries.

#### Scenario: Detail action bar owns pin controls
- **WHEN** the main list or an archive group preview renders history rows
- **THEN** each row remains one compact selection target without an inline pin or unpin button
- **AND** the corresponding history detail exposes pin or unpin in its first header action bar.
