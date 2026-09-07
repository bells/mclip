## Purpose

Organize mclip settings by what users control, consolidating interface preferences while preserving immediate saving, localized search, keyboard access, and data retention semantics.

## ADDED Requirements

### Requirement: Distinct settings navigation names

Preferences SHALL display a General navigation group containing Behavior, Appearance, History, and Privacy, followed by a Tools group containing Text Actions and Agent CLI, with localized equivalent names.

#### Scenario: Read navigation in a supported language
- **WHEN** Preferences renders in Chinese, English, or Japanese
- **THEN** its former mclip navigation group is named General in that language
- **AND** the former General destination is named Behavior rather than duplicating the group label
- **AND** the initial destination remains the behavior page
- **AND** the active page is identified visually and programmatically.

### Requirement: Interface preferences have one destination

The system SHALL locate interface language, appearance theme, tray icon, main-window branding, and row numbers on Appearance. Behavior SHALL retain launch, auto-paste and relevant platform capability controls; History SHALL contain capture types, ordinary-history retention limits and main/group display counts.

#### Scenario: Browse Appearance
- **WHEN** the user opens Appearance
- **THEN** language and theme appear in an Interface group
- **AND** tray icon options have their own labeled group
- **AND** branding and row numbers appear in List display
- **AND** these controls are not duplicated on another settings page.

#### Scenario: Distinguish presentation from retention
- **WHEN** the user opens History
- **THEN** save types and the ordinary-history retention limit are available
- **AND** main and group display counts appear in a List display group on History
- **AND** descriptions state that pinned items are counted separately without changing existing count bounds or trimming behavior.

#### Scenario: Search after controls move
- **WHEN** the user searches localized metadata for a moved setting and activates a result
- **THEN** its path points to Appearance for language and to History for either display count
- **AND** the corresponding control is scrolled into view and receives visible focus
- **AND** the search index excludes private settings values and clipboard content.

#### Scenario: Existing settings and pending writes
- **WHEN** a user with existing saved settings opens the reorganized pages and edits a setting
- **THEN** existing values are preserved without a data migration
- **AND** edits apply immediately through ordered saving with latest-edit protection and failure rollback
- **AND** navigation and unrelated controls remain usable without a Save or Cancel footer.

### Requirement: Settings retain readable cross-theme states

Preferences SHALL preserve readable layout and complete interaction feedback in light, dark, and system appearance across all six destinations and supported languages.

#### Scenario: Long labels in the fixed settings window
- **WHEN** supported localized text is displayed in the existing desktop settings window
- **THEN** full setting labels and meaningful action text remain readable
- **AND** the content can scroll vertically to every control without horizontal page overflow
- **AND** normal description text is visually subordinate to setting names and is not confused with a warning.

#### Scenario: Privacy and CLI status
- **WHEN** source exclusion is unavailable, an ignored app is invalid, or a CLI operation is pending or failed
- **THEN** text identifies the state and any available recovery action in both themes
- **AND** unavailable behavior is not presented as successfully active
- **AND** disabled actions are programmatically disabled and cannot be repeated while in flight.

#### Scenario: Installed CLI is not an error
- **WHEN** the CLI is current or newer than the desktop target
- **THEN** its status uses a normal or positive visual role in either theme rather than danger styling
- **AND** the visible state and available action continue to reflect the actual installed version without automatic downgrade.

#### Scenario: Explain privacy to the user
- **WHEN** privacy or auto-paste permission descriptions render
- **THEN** primary instructions describe user-visible behavior rather than detector versions, stored metadata, or development commands
- **AND** local plaintext storage, display-only masking, detection limitations, and required permissions remain accurately disclosed.


#### Scenario: Switch off while hovered
- **WHEN** a user switches a setting off and keeps the pointer over its track
- **THEN** the track immediately uses the same off-state color as when the pointer leaves in both light and dark themes
- **AND** focus-visible, disabled semantics and immediate-save rollback remain intact.
