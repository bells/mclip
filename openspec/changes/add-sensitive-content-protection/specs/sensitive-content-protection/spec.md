## ADDED Requirements

### Requirement: Local bounded secret classification
mclip SHALL classify supported secret patterns locally in text history only, using a versioned bounded detector, and SHALL NOT send clipboard content to a network service.

#### Scenario: Supported high-confidence secret
- **GIVEN** copied text contains a supported synthetic PEM private key, JWT, AWS access-key ID, or provider-specific API-key form
- **WHEN** the text is accepted into history
- **THEN** its text variant records the matching `secretType` and detector version
- **AND** its original text remains unchanged.

#### Scenario: Ordinary text
- **GIVEN** copied text matches no supported detector
- **WHEN** the text is accepted into history
- **THEN** secret classification is absent
- **AND** it renders as ordinary text.

#### Scenario: Oversized text
- **GIVEN** text exceeds the detector byte limit
- **WHEN** classification is attempted
- **THEN** the detector does not scan beyond its bound
- **AND** returns a stable bounded-result status without logging the text.

### Requirement: Safe-by-default desktop presentation
Desktop history rows, previews, details, and search results SHALL mask classified text by default and SHALL reveal it only transiently after an explicit user action.

#### Scenario: Secret appears in a list
- **GIVEN** a classified text entry exists
- **WHEN** it appears in any history list or preview
- **THEN** the visible content and `displayText` are masked
- **AND** the UI identifies it as sensitive without exposing the raw value.

#### Scenario: Explicit transient reveal
- **WHEN** the user activates reveal for one classified entry
- **THEN** that window shows the original text for that entry
- **AND** reveal state is cleared when the item changes, the window hides, search changes, or the app restarts.

#### Scenario: Reveal legacy text without persisted classification
- **GIVEN** a legacy text entry has no persisted secret classification
- **WHEN** the user explicitly activates reveal from a masked stale preview
- **THEN** Rust performs one bounded in-memory classification of the canonical text
- **AND** reveals it only when detector v1 currently matches
- **AND** does not rewrite the history file solely because reveal was requested.

#### Scenario: Reveal a stale or deleted item
- **GIVEN** an item was deleted externally or the preview classification no longer matches the canonical entry
- **WHEN** the user activates reveal
- **THEN** Rust returns `itemNotFound` or `classificationStale` without content
- **AND** the desktop refreshes its history snapshot and closes the stale detail
- **AND** the main window reports that the record changed instead of showing a generic reveal failure.

#### Scenario: Reveal cannot access history
- **WHEN** the reveal path cannot load or reconcile history
- **THEN** Rust returns the stable content-free `historyUnavailable` code
- **AND** the frontend presents a distinct retryable history-unavailable message.

#### Scenario: Hover does not reveal
- **WHEN** a classified entry is focused or hovered
- **THEN** its previews remain masked until reveal is explicitly activated.

#### Scenario: Copy classified entry
- **WHEN** the user explicitly copies a classified history entry
- **THEN** mclip writes the exact original content to the system clipboard
- **AND** does not replace it with the mask.

### Requirement: Safe-by-default CLI and Agent output
Read-only CLI and Agent formats SHALL mask classified content by default while preserving explicit raw/reveal access.

#### Scenario: Default structured output
- **WHEN** a classified entry is returned by `list`, `get`, `search`, `context`, or `agent` in JSON/default format
- **THEN** content fields are masked
- **AND** classification metadata indicates that the value is sensitive
- **AND** raw content is absent.

#### Scenario: Existing raw option
- **WHEN** the user explicitly selects `--raw` for a command that supports it
- **THEN** the command may output original classified content
- **AND** CLI help identifies raw output as a secret-reveal operation.

#### Scenario: Explicit reveal option
- **WHEN** the user supplies `--reveal-secrets` to a supported non-raw format
- **THEN** original content is included only in that invocation.

#### Scenario: Copy command uses original
- **WHEN** `mclip-cli copy` selects a classified history item
- **THEN** the original content is written to the system clipboard
- **AND** the action result does not echo that content.

### Requirement: Ignored source applications
mclip SHALL allow users to configure a bounded deduplicated set of normalized source-application identifiers and SHALL skip history capture when the observed source identity matches.

#### Scenario: Configured source matches
- **GIVEN** source-app detection is available
- **AND** the clipboard change is attributed to a configured ignored identifier
- **WHEN** the watcher handles the change
- **THEN** it skips full clipboard persistence for that change
- **AND** emits no history mutation containing the ignored content.

#### Scenario: Source identity unavailable
- **GIVEN** the platform cannot identify the source application
- **WHEN** a clipboard change occurs
- **THEN** mclip does not claim an ignored-app rule matched
- **AND** Preferences reports source-based exclusion as unavailable or degraded.

#### Scenario: Exact normalized matching
- **GIVEN** an ignored identifier is configured
- **WHEN** a different application has a partially similar display name
- **THEN** it is not ignored unless its normalized stable identifier is an exact match.

### Requirement: Immediate privacy settings
Sensitive-content masking and ignored-source settings SHALL use the existing immediate-apply/immediate-save Preferences flow and SHALL expose failure without persisting a false state.

#### Scenario: Default settings
- **GIVEN** no v0.2.0 privacy settings exist
- **WHEN** settings load
- **THEN** sensitive-content masking is enabled
- **AND** ignored-source identifiers are empty.

#### Scenario: Save ignored identifier fails
- **WHEN** persistence of an ignored-source change fails
- **THEN** Preferences reports the error
- **AND** restores the last persisted value
- **AND** does not show Save or Cancel footer buttons.

### Requirement: Privacy-safe diagnostics
Logs, telemetry, events, errors, and performance records SHALL exclude raw secret content, match fragments, file paths, source-app names, and configured ignored identifiers.

#### Scenario: Detector or exclusion error
- **WHEN** classification or source-app matching returns an error
- **THEN** diagnostics contain only stable operation/reason codes and bounded metadata
- **AND** no clipboard value or application identifier is included.

### Requirement: Honest storage and migration behavior
mclip SHALL disclose that masking is not encryption at rest and SHALL load v0.1.1 history/settings with safe defaults without rewriting on read alone.

#### Scenario: Load legacy entry
- **GIVEN** a v0.1.1 text entry has no classification fields
- **WHEN** v0.2.0 loads it
- **THEN** the entry remains readable with original content and stable ID
- **AND** the history file is not rewritten solely by loading.

#### Scenario: Privacy explanation
- **WHEN** a user views privacy settings or CLI help for reveal behavior
- **THEN** mclip states that history remains local plaintext in v0.2.0
- **AND** states that detectors and ignored-app matching can have platform limitations and false results.
