## Purpose

Make local text transformations easy to scan and invoke in compact history details, with clear result actions and explicit asynchronous, privacy, and failure states.

## ADDED Requirements

### Requirement: Grouped text transformation controls

Text details SHALL organize applicable enabled actions in labeled JSON, Base64, and URL component rows, allowing a displayed action to be invoked in one activation.

#### Scenario: View available transformations
- **WHEN** readable text has applicable transformations
- **THEN** each non-empty type row contains its applicable enabled actions in stable order
- **AND** JSON uses prettify and minify labels while encoding types use encode and decode labels
- **AND** each action has an accessible name containing its type and operation
- **AND** a grouping row does not imply a persistent selected transform mode.

#### Scenario: An operation or type is inapplicable
- **WHEN** validation rejects JSON or a decode action, or a type is disabled in settings
- **THEN** that operation is not offered
- **AND** rows with no available actions do not occupy empty space
- **AND** images and file entries never expose text transformations.

#### Scenario: Disabled transformations
- **WHEN** all transform types are disabled
- **THEN** the transform area and its reveal hint are absent

#### Scenario: Masked transformations
- **WHEN** at least one type is enabled but the entry is masked
- **THEN** only a localized hint to reveal the content is shown in that area
- **AND** masked content is not submitted for action applicability checking.

### Requirement: Transformation discovery and execution feedback

The system SHALL distinguish loading, available, empty, failed, and executing transformation states without showing stale actions or reopening stale results.

#### Scenario: Discovery takes time
- **WHEN** action discovery remains pending long enough to require feedback
- **THEN** a localized loading status appears without showing clickable stale actions
- **AND** completion replaces it with applicable rows or removes an empty tools area.

#### Scenario: Discovery fails
- **WHEN** available transformations cannot be loaded
- **THEN** a localized error and Retry action appear near the transform area
- **AND** retry checks only the current item and current settings.

#### Scenario: Entry changes during execution
- **WHEN** an operation is pending and the user changes or closes its source detail
- **THEN** a late response cannot overwrite a new item's actions or reopen its obsolete result window
- **AND** repeated activation cannot create duplicate execution windows for the pending request.

### Requirement: Result actions communicate consequences

The independent result window SHALL prioritize Copy result, present Replace history as a secondary confirmed action, and preserve non-destructive local transform semantics.

#### Scenario: Inspect a short result
- **WHEN** a short result is shown in the fixed result window
- **THEN** the app surface fills its available content height without an unintended transparent area below the actions
- **AND** the bottom actions remain anchored to the window content boundary.

#### Scenario: Inspect a long result
- **WHEN** a result up to the existing supported output limit is shown
- **THEN** result content can scroll while the operation title, close control and bottom actions remain reachable
- **AND** showing the result does not widen the main window or write history or clipboard.

#### Scenario: Copy result succeeds
- **WHEN** the user activates Copy result
- **THEN** the transformed text is written to the system clipboard using existing watcher and dedupe behavior
- **AND** the result window closes using its existing successful completion flow without relying on color alone as feedback.

#### Scenario: Confirm replacement once
- **WHEN** the user activates Replace history
- **THEN** an explicit confirmation identifies the replacement consequence
- **AND** its confirmation action cannot submit again while replacement is pending
- **AND** a successful replacement preserves the existing history identity and pin metadata.

#### Scenario: Replacement or copying fails
- **WHEN** an explicit result action fails
- **THEN** a localized error appears near that action
- **AND** the result remains available and the appropriate retry is enabled after completion
- **AND** no error includes the original or transformed private content.

#### Scenario: Result actions in either theme
- **WHEN** the result window renders in light or dark appearance
- **THEN** Copy result has the primary action emphasis, Replace history is secondary, and destructive confirmation uses the danger role
- **AND** button text and focus are readable against the actual surface.


### Requirement: Compact detail height follows rendered content

Both independent compact detail windows SHALL resize to their actual header, bounded content, conversion rows and metadata, preserving native work-area bounds and non-focusable behavior.

#### Scenario: Short text or fewer applicable actions
- **WHEN** text, applicable action rows or discovery/reveal state changes
- **THEN** the native detail height follows measured content without reserving unused action rows
- **AND** long content scrolls, metadata remains visible and the image viewer keeps its full-size layout
- **AND** measurements cannot show a hidden window or move the preview family horizontally.
