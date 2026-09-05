## ADDED Requirements

### Requirement: Select ignored applications without identifiers
Preferences SHALL offer an application list with add and remove actions instead of a manually entered identifier.

#### Scenario: Add applications
- **WHEN** the user activates add and selects supported applications in the native chooser
- **THEN** the system derives exact normalized identifiers and immediately saves new unique entries
- **AND** the list displays local application names and available icons.

#### Scenario: Cancel or select invalid files
- **WHEN** the user cancels or selects an application without a valid source identifier
- **THEN** existing settings remain unchanged
- **AND** an invalid selection shows a localized error without exposing paths in logs.

#### Scenario: Duplicates and limits
- **WHEN** selected applications already exist or would exceed 100 unique exclusions
- **THEN** duplicates are ignored and an over-limit batch is rejected without silently dropping existing entries.

### Requirement: Preserve and manage exclusions
The application SHALL retain the existing persisted identifier format and exact source matching semantics.

#### Scenario: Reopen or remove an entry
- **WHEN** Preferences is reopened or a selected row is removed
- **THEN** local names are resolved where available and unresolved IDs remain visible and removable
- **AND** removal uses the existing immediate-save flow, including rollback on failure.

#### Scenario: Source detection unavailable
- **WHEN** the current platform cannot detect source applications
- **THEN** the page explains the limitation and disables adding ineffective exclusions
- **AND** existing entries can still be removed.

#### Scenario: Accessible localized controls
- **WHEN** the user navigates the list with the keyboard in Chinese, English or Japanese
- **THEN** list selection, add/remove actions, progress and errors are accessible and localized.
