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

### Requirement: Light Theme Readability

The system SHALL render the light theme with readable contrast across all
clipboard utility surfaces, including text, row numbers, metadata labels,
interactive controls, and transient preview windows.

#### Scenario: Main list numbers remain readable in light theme

- **GIVEN** `appearanceTheme` is `light`
- **AND** row number visibility is enabled
- **WHEN** the main history list renders over a busy desktop background
- **THEN** `.app-item-index` labels are readable in default rows
- **AND** `.app-item-index` labels remain readable in hovered and selected rows
- **AND** their color is controlled by a semantic light-theme token rather than a dark-theme raw accent opacity value.

#### Scenario: Archive preview numbers remain readable in light theme

- **GIVEN** `appearanceTheme` is `light`
- **AND** row number visibility is enabled
- **WHEN** an archive group preview renders
- **THEN** `.app-history-preview-index` labels are readable in default rows
- **AND** `.app-history-preview-index` labels remain readable in hovered and selected rows
- **AND** hiding row numbers still removes the numeric column without leaving empty space.

#### Scenario: Detail metadata labels remain readable in light theme

- **GIVEN** `appearanceTheme` is `light`
- **WHEN** an item detail preview or preview-detail window renders
- **THEN** metadata labels such as source app, first copied time, last copied time, and copy count are readable on the light preview panel
- **AND** metadata values remain visually stronger than metadata labels
- **AND** both labels and values keep their contrast when the preview is displayed over a detailed wallpaper.

#### Scenario: Light theme surfaces protect content from wallpaper bleed

- **GIVEN** `appearanceTheme` is `light`
- **WHEN** main, preview, preview-detail, About, Preferences, or a modal window renders
- **THEN** the local panel surface is opaque enough for readable text
- **AND** translucent effects do not make desktop wallpaper detail compete with content
- **AND** light theme surfaces do not drift into a generic beige or washed-out cream palette.

#### Scenario: Theme colors meet token-level contrast checks

- **GIVEN** light theme tokens are defined
- **WHEN** theme contrast regression checks run
- **THEN** readable text token pairs meet WCAG AA 4.5:1 where they are used for normal text
- **AND** row-number, metadata-label, icon, focus, selected, and border token pairs meet at least 3:1 where they communicate UI structure or state.

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
