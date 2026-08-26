## ADDED Requirements

### Requirement: Backward-compatible pin metadata
Every history entry SHALL expose symmetric `isPinned` and `pinnedAt` fields, and entries created before v0.2.0 SHALL load as unpinned without a read-only migration rewrite.

#### Scenario: Load a v0.1.1 entry
- **GIVEN** a persisted text, image, or files entry has no pin fields
- **WHEN** v0.2.0 loads history
- **THEN** `isPinned` is `false`
- **AND** `pinnedAt` is absent
- **AND** the file is not rewritten solely because it was loaded.

#### Scenario: Repair inconsistent pin metadata
- **GIVEN** a persisted entry has `isPinned` set to `false` and a non-null `pinnedAt`
- **WHEN** history is sanitized
- **THEN** `pinnedAt` is cleared before the next persisted mutation.

### Requirement: Deterministic pinned ordering
The canonical history order SHALL place pinned entries first by most-recent pin time and unpinned entries second by most-recent copy time, with stable tie-breaking.

#### Scenario: Mixed history order
- **GIVEN** history contains pinned and unpinned entries
- **WHEN** a snapshot, search result, preview payload, or CLI list is produced
- **THEN** every pinned match appears before every unpinned match
- **AND** pinned matches are ordered by `pinnedAt` descending
- **AND** unpinned matches are ordered by `lastCopiedAt` descending.

#### Scenario: Pin an unpinned entry
- **WHEN** a user pins an unpinned entry
- **THEN** `isPinned` becomes `true`
- **AND** `pinnedAt` is set to the mutation time
- **AND** one revisioned upsert updates all subscribed history surfaces.

#### Scenario: Unpin an entry
- **WHEN** a user unpins a pinned entry
- **THEN** `isPinned` becomes `false`
- **AND** `pinnedAt` is cleared
- **AND** the entry returns to chronological unpinned order.

### Requirement: Pin state survives deduplication
Copying content that already exists SHALL preserve the existing entry's pin state while applying the ordinary dedupe timestamp and count update.

#### Scenario: Recopy pinned text
- **GIVEN** a text entry is pinned
- **WHEN** the same text is copied again
- **THEN** the existing entry ID and pin metadata are preserved
- **AND** `lastCopiedAt` and `copyCount` are updated
- **AND** `pinnedAt` is not changed.

### Requirement: Automatic retention protects bounded pins
Automatic maximum-history trimming SHALL exclude pinned entries, SHALL bound pins separately, and SHALL retain assets referenced by pins.

#### Scenario: Unpinned history exceeds maximum
- **GIVEN** pinned entries exist
- **AND** unpinned entries exceed `maxHistoryCount`
- **WHEN** automatic trimming runs
- **THEN** only excess unpinned entries are removed
- **AND** pinned entries and their image assets remain.

#### Scenario: Pin cap reached
- **GIVEN** `MAX_PINNED_HISTORY_COUNT` entries are pinned
- **WHEN** a user attempts to pin another entry
- **THEN** the operation returns a typed limit error
- **AND** history and revision remain unchanged.

#### Scenario: Unpin makes old entry eligible for trim
- **GIVEN** an old pinned entry would fall outside the unpinned retention window
- **WHEN** the user unpins it
- **THEN** the normal trim pass may remove it
- **AND** unused image assets are cleaned only after the entry is removed.

### Requirement: Explicit destructive pin behavior
Specific deletion and confirmed clear-all actions SHALL be able to remove pins, and every bulk clear result SHALL state whether pins were included.

#### Scenario: Delete a pinned ID
- **WHEN** a user confirms deletion of a specific pinned entry
- **THEN** that entry is removed through the ordinary remove mutation
- **AND** any now-unused image asset is cleaned.

#### Scenario: Confirm clear all
- **GIVEN** history contains pinned entries
- **WHEN** the user invokes the existing confirmed clear-all action
- **THEN** pinned and unpinned entries are removed
- **AND** the confirmation and result include the number of pins removed.

#### Scenario: Clear while keeping pins
- **GIVEN** history contains pinned and unpinned entries
- **WHEN** the user selects the keep-pinned clear mode
- **THEN** only unpinned entries are removed
- **AND** pinned entries remain in canonical order.

### Requirement: Desktop and CLI pin operations
The desktop and `mclip-cli` SHALL mutate the same persisted pin state by stable entry ID and SHALL expose pinned filtering.

#### Scenario: CLI pin by ID
- **WHEN** the user runs `mclip-cli pin --id ENTRY_ID`
- **THEN** the selected entry is pinned atomically
- **AND** the action result includes the entry ID and final pin state.

#### Scenario: CLI filter pinned entries
- **WHEN** the user runs a supported read command with `--pinned`
- **THEN** only pinned entries are returned
- **AND** the selected output format remains valid.

#### Scenario: CLI add returns the mutated entry behind pins
- **GIVEN** pinned entries remain ahead of chronological history
- **WHEN** `mclip-cli add` creates or deduplicates an unpinned text entry
- **THEN** the action result reports the stable ID of that saved text entry
- **AND** it does not substitute the ID of the first pinned entry in canonical order.

#### Scenario: Stale desktop toggle request
- **GIVEN** the frontend has stale pin state for an entry
- **WHEN** it requests a toggle
- **THEN** the repository resolves the current state atomically
- **AND** emits one final-state upsert rather than trusting the stale boolean.
