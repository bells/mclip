# appearance-settings Specification

## ADDED Requirements

### Requirement: Appearance Theme Setting

The system SHALL provide an appearance theme setting with values `system`, `light`, and `dark`.

#### Scenario: Default theme follows system

- **GIVEN** no saved appearance theme exists
- **WHEN** settings are loaded
- **THEN** `appearanceTheme` is `system`
- **AND** the rendered app uses the current system color scheme.

#### Scenario: Explicit light theme

- **GIVEN** `appearanceTheme` is `light`
- **WHEN** any mclip frontend window renders
- **THEN** the window uses the light theme tokens regardless of system color scheme.

#### Scenario: Explicit dark theme

- **GIVEN** `appearanceTheme` is `dark`
- **WHEN** any mclip frontend window renders
- **THEN** the window uses the dark theme tokens regardless of system color scheme.

#### Scenario: System theme changes while open

- **GIVEN** `appearanceTheme` is `system`
- **WHEN** the OS appearance changes between light and dark
- **THEN** main, preview, preview-detail, About, and Preferences update to the resolved theme without restarting mclip.

### Requirement: Row Number Visibility Setting

The system SHALL provide a setting that controls whether row-leading history item numbers are displayed.

#### Scenario: Numbers visible by default

- **GIVEN** no saved row number visibility setting exists
- **WHEN** history rows render
- **THEN** main list rows and archive preview rows show their leading numeric labels.

#### Scenario: Numbers hidden

- **GIVEN** row number visibility is disabled
- **WHEN** history rows render
- **THEN** main list rows and archive preview rows do not show leading numeric labels
- **AND** row content aligns without an empty numeric column.

### Requirement: macOS Template Menu Bar Icon

The system SHALL use native macOS template image behavior for the light menu bar icon style on macOS.

#### Scenario: Light icon on macOS

- **GIVEN** the app is running on macOS
- **AND** `menuBarIconStyle` is `light`
- **WHEN** the tray/menu bar icon is configured
- **THEN** the underlying `NSImage` is marked as a template image
- **AND** macOS can adapt its color to the menu bar appearance.

#### Scenario: Light icon on Windows

- **GIVEN** the app is running on Windows
- **AND** `menuBarIconStyle` is `light`
- **WHEN** the tray icon is configured
- **THEN** mclip uses the existing light icon asset without macOS-only template APIs.
