## ADDED Requirements

### Requirement: Expanded Ordinary History Retention

The system SHALL default to 200 ordinary history entries and accept `maxHistoryCount` from 10 through 1000 inclusive, consistently in Rust sanitization, frontend normalization and Preferences controls. Pinned entries SHALL remain separate from this limit.

#### Scenario: Existing settings remain valid

- **WHEN** existing settings with a retention limit of 200 or 500 are loaded
- **THEN** the selected value remains unchanged and no migration rewrites history

#### Scenario: New upper bound and dependent display count

- **WHEN** a user selects a retention limit of 1000
- **THEN** the system accepts the value and permits a main-window count through 1000
- **AND** values above 1000 are clamped to 1000
- **AND** archive group size remains bounded by 100

#### Scenario: Retention preserves pinned entries

- **GIVEN** 1000 ordinary entries and retained pinned entries
- **WHEN** a new ordinary entry is inserted
- **THEN** only the oldest ordinary entry is trimmed and pinned entries remain
