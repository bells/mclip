## Purpose

Provide a localized native tray entry into existing Preferences so users can reach settings directly while retaining predictable desktop window and tray behavior.

## ADDED Requirements

### Requirement: Localized tray settings menu

The system SHALL expose Preferences, a separator, and Quit mclip in that order in its supported native tray context menu, using the resolved application language.

#### Scenario: Open the tray context menu
- **WHEN** the user opens the native tray context menu in a supported desktop session
- **THEN** Preferences appears before a separator and Quit mclip
- **AND** left-click behavior remains the existing main-window toggle where the platform delivers that event.

#### Scenario: Change application language
- **WHEN** the user saves Chinese, English, Japanese, or Follow System language settings
- **THEN** both menu labels use the resolved supported language on the next menu opening without restarting
- **AND** Follow System resolves Chinese and Japanese locales to their respective languages and other locales to English
- **AND** the existing native status item is retained.

#### Scenario: Tray integration is unavailable
- **WHEN** a Linux session cannot expose the supported tray menu
- **THEN** the existing in-app Preferences entry remains available when the main window is reachable
- **AND** desktop capability reporting does not claim tray support.

### Requirement: Preferences entry shares the window lifecycle

The tray Preferences action SHALL open and focus the existing Preferences surface without duplicate windows, stale previews, or destructive side effects.

#### Scenario: First open from tray
- **WHEN** the user selects Preferences before it has been opened in this process
- **THEN** the settings window is prepared before it is shown and focused
- **AND** any old main preview family is closed and cannot reopen from a stale request
- **AND** clipboard content and saved history remain unchanged.

#### Scenario: Open an existing settings window
- **WHEN** the user invokes Preferences repeatedly, including while creation is pending
- **THEN** at most one settings window exists
- **AND** the existing window is shown or focused without losing pending settings saves.

#### Scenario: Opening fails
- **WHEN** the settings window cannot be prepared or shown
- **THEN** mclip remains running and a subsequent menu invocation can retry
- **AND** any diagnostic or user feedback contains no clipboard content or private paths.

#### Scenario: Native appearance differs from application appearance
- **WHEN** application appearance is explicitly light while the OS is dark, or the reverse
- **THEN** the native menu continues to follow platform rendering conventions
- **AND** opening Preferences uses the chosen application appearance.
