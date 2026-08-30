## ADDED Requirements

### Requirement: History Preferences Organization

The system SHALL place history capture limits and display-count settings on a dedicated History page in task order.

#### Scenario: History page groups

- **WHEN** the History destination renders
- **THEN** saved content types appear in a Capture group
- **AND** maximum history count appears in a Retention group
- **AND** main-window item count and archive-group item count appear in a Display group
- **AND** existing internal setting keys remain unchanged.

#### Scenario: Existing value bounds remain visible

- **WHEN** a history count setting renders
- **THEN** Preferences exposes its current valid range
- **AND** `maxHistoryCount` remains bounded by `10..=500`
- **AND** `mainWindowItemCount` remains bounded by `5..=maxHistoryCount`
- **AND** `historyGroupItemCount` remains bounded by `5..=100`.

#### Scenario: History settings remain immediate

- **WHEN** the user changes a saved type or enters a valid history count
- **THEN** the existing normalization and immediate save flow runs
- **AND** lowering maximum history count still reconciles main-window item count
- **AND** the History page remains interactive while persistence is pending.

#### Scenario: Numeric edit intermediate state

- **WHEN** the user temporarily clears or partially edits a history numeric field
- **THEN** Preferences preserves the local input string until it becomes valid or loses focus
- **AND** it does not persist `NaN`, an empty value, or an out-of-range value.
