## ADDED Requirements

### Requirement: Grouped Settings Center Navigation

The system SHALL present Preferences as a two-column settings center with stable grouped destinations.

#### Scenario: Settings center opens

- **WHEN** the Preferences window renders
- **THEN** the left column shows search and grouped navigation
- **AND** the right column shows the selected page title, description, and settings
- **AND** the default selected destination is General.

#### Scenario: Navigation groups remain concise

- **WHEN** all settings destinations are listed
- **THEN** General, Appearance, History, and Privacy appear under the `mclip` group
- **AND** Text Actions and Agent CLI appear under the Tools group
- **AND** the active destination is visually and programmatically identified.

#### Scenario: Navigate between pages

- **WHEN** the user activates a destination by pointer or keyboard
- **THEN** the corresponding page replaces the content column
- **AND** keyboard focus can move to the page heading
- **AND** navigation does not discard pending settings saves.

### Requirement: Localized Settings Search

The system SHALL provide local search across user-facing setting metadata without inspecting private setting values.

#### Scenario: Find a setting in the active language

- **GIVEN** Preferences is displayed in Chinese or English
- **WHEN** the user enters a case-insensitive substring of a setting title, description, page path, or allowlisted alias
- **THEN** matching settings appear with their destination path
- **AND** results use the active language.

#### Scenario: Open a search result

- **WHEN** the user activates a search result
- **THEN** Preferences selects the result's destination
- **AND** scrolls the corresponding setting into view
- **AND** moves focus to that setting's primary control.

#### Scenario: Search excludes private values

- **WHEN** the search index is created
- **THEN** it does not include clipboard content, source application identifiers, CLI installation paths, setting error details, or current setting values
- **AND** search runs without network access or content logging.

#### Scenario: No search result

- **WHEN** a non-empty query matches no setting metadata
- **THEN** Preferences shows a localized empty result message
- **AND** navigation and current settings remain available.

### Requirement: Setting Controls Match Their Semantics

The system SHALL render each setting with a control appropriate to its value and action semantics.

#### Scenario: Boolean preference

- **WHEN** a persisted boolean preference renders
- **THEN** its label and description appear on the left
- **AND** a right-aligned control exposes `role="switch"` and the current `aria-checked` value.

#### Scenario: Enum and numeric preferences

- **WHEN** an enum or bounded numeric preference renders
- **THEN** it uses a keyboard-accessible select, listbox, or numeric field
- **AND** valid bounds and the current value remain available to assistive technology.

#### Scenario: Status and explicit actions

- **WHEN** a capability status, reclassification action, or CLI installation action renders
- **THEN** it is presented as status or an action button rather than as a persisted switch
- **AND** destructive or security-sensitive actions retain their existing confirmation and capability boundaries.

### Requirement: Immediate Non-blocking Preference Persistence

The system SHALL preserve immediate apply and save behavior without disabling the settings center during normal saves.

#### Scenario: Change a setting

- **WHEN** the user changes a valid preference
- **THEN** the visible value updates immediately
- **AND** a normalized full settings snapshot is queued through the existing save command
- **AND** no Save, Apply, Cancel, or OK footer is shown.

#### Scenario: Save is pending

- **WHEN** one or more preference saves are pending
- **THEN** navigation, search, and unrelated controls remain interactive
- **AND** only actions that cannot safely repeat may be temporarily disabled
- **AND** pending feedback is associated with the affected setting rather than the entire page.

#### Scenario: Rapid sequential changes

- **WHEN** the user changes multiple settings before earlier saves finish
- **THEN** saves execute in order using normalized snapshots
- **AND** an older response does not overwrite a newer visible value
- **AND** the final persisted settings match the latest accepted edits.

#### Scenario: Latest save fails

- **WHEN** the latest save for a setting fails
- **THEN** Preferences restores the last canonical value when no newer edit supersedes it
- **AND** displays a localized row-level error
- **AND** does not flash or disable the whole page.

### Requirement: Preferences Keyboard and Accessibility Behavior

The system SHALL provide predictable keyboard navigation and programmatic relationships throughout Preferences.

#### Scenario: Navigate the settings center by keyboard

- **WHEN** a keyboard user tabs through Preferences
- **THEN** search, navigation destinations, page controls, and actions receive visible focus in logical order
- **AND** every setting is associated with its label and description
- **AND** page and group headings preserve a meaningful document hierarchy.

#### Scenario: Escape with a search query

- **GIVEN** the search query is not empty
- **WHEN** the user presses `Escape`
- **THEN** the query is cleared
- **AND** the Preferences window remains visible
- **AND** focus returns to search.

#### Scenario: Escape without a search query

- **GIVEN** the search query is empty and no nested listbox is handling `Escape`
- **WHEN** the user presses `Escape`
- **THEN** Preferences uses the existing hide-window behavior.

### Requirement: Privacy Controls Remain Explicit

The system SHALL organize privacy controls without introducing a master privacy switch that obscures independent behavior.

#### Scenario: Privacy page renders

- **WHEN** the Privacy destination is selected
- **THEN** sensitive-content masking, source application exclusion, source-detection capability, and explicit legacy reclassification remain available
- **AND** no single control implicitly disables all privacy behavior.

#### Scenario: Masking disclosure remains visible

- **WHEN** sensitive-content masking is shown or changed
- **THEN** Preferences explains that masking affects presentation while original local content remains canonical for copy and explicit reveal
- **AND** masking is not described as encryption at rest.

#### Scenario: Source exclusion is unavailable

- **WHEN** the current platform cannot provide a supported stable source identity
- **THEN** Preferences reports exclusion as unavailable or degraded using a localized capability message
- **AND** does not claim that an application was ignored.
