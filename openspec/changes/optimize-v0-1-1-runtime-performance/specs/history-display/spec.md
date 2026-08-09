## ADDED Requirements

### Requirement: Efficient history refresh preserves visible state
The system SHALL keep the main history, grouping, search results, row positions, and preview reconciliation correct when history synchronization changes from full broadcasts to revisioned deltas.

#### Scenario: Insert a new clipboard entry with no search
- **GIVEN** the main window shows the latest history and no search query is active
- **WHEN** a new clipboard entry is persisted
- **THEN** the new entry appears at position 1
- **AND** visible positions and archive groups are recalculated from the new revision
- **AND** any old item or group preview is closed.

#### Scenario: Deduplicate an existing entry
- **GIVEN** an existing history entry is copied again
- **WHEN** its revisioned upsert is applied
- **THEN** that entry moves to position 1 with updated copy count and copied time
- **AND** it is not duplicated in the main list or archive groups.

#### Scenario: Delete an entry shown in a preview
- **GIVEN** `preview` or `preview-detail` shows an entry
- **WHEN** that entry is deleted from the main window, preview, viewer, or CLI-observed durable history
- **THEN** the affected detail closes
- **AND** no stale asynchronous show request reopens it
- **AND** remaining main and group positions match the newest revision.

#### Scenario: Receive changes out of order
- **GIVEN** the frontend has applied history revision 12
- **WHEN** a delayed result or event for revision 11 arrives
- **THEN** the older change is ignored
- **AND** the visible history is not reverted or duplicated.

### Requirement: Reused image data preserves detail correctness
The system SHALL reuse unchanged image data across list, preview, detail, and image viewer surfaces without changing loading, failure, deletion, or aspect-ratio behavior.

#### Scenario: Move from image detail to maximized viewer
- **GIVEN** an image detail has successfully loaded its current asset
- **WHEN** the user opens the maximized image viewer
- **THEN** the viewer may reuse the unchanged cached image data
- **AND** still renders the complete shared history detail, metadata, controls, and proportional image.

#### Scenario: Cached image is no longer valid
- **GIVEN** an image was previously loaded
- **WHEN** its asset is removed, replaced, or fails validation before another detail renders
- **THEN** the surface shows the existing localized loading or failure state as appropriate
- **AND** it does not render stale cached image content.

#### Scenario: Delete image from viewer
- **GIVEN** the maximized viewer displays an image history item
- **WHEN** the user deletes that item
- **THEN** history state and image cache invalidation complete consistently
- **AND** the viewer closes, main remains recoverable, and no old preview reopens.

### Requirement: History retention uses symmetric expanded bounds
The system SHALL default new settings to 200 retained history entries and SHALL allow `maxHistoryCount` values from 10 through 500 with matching Rust and TypeScript constraints.

#### Scenario: Create default settings
- **WHEN** mclip creates settings for a new installation
- **THEN** `maxHistoryCount` is `200`.

#### Scenario: Configure the expanded maximum
- **WHEN** the user enters `500` as the maximum history count
- **THEN** the frontend accepts and persists the value
- **AND** Rust keeps `500` after sanitization
- **AND** history is trimmed only when it exceeds that configured count.

#### Scenario: Reject a value above the expanded maximum
- **WHEN** a settings payload contains a `maxHistoryCount` greater than `500`
- **THEN** both frontend normalization and Rust sanitization clamp it to `500`.
