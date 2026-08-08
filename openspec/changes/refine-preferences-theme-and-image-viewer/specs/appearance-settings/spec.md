## MODIFIED Requirements

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

#### Scenario: Light selected rows use one interaction hue

- **GIVEN** `appearanceTheme` is `light`
- **WHEN** a history row is selected or keyboard-active
- **THEN** the complete selected background and border use the semantic teal interaction family
- **AND** warm metadata colors are not mixed into the selection gradient.

#### Scenario: Theme-aware controls remain readable

- **GIVEN** any supported appearance theme is active
- **WHEN** an active switch, accent action, or danger action renders
- **THEN** its background and foreground come from semantic theme tokens
- **AND** normal-size text meets WCAG AA contrast against the action background
- **AND** hover, focus, disabled, and pressed states remain distinguishable.

#### Scenario: Theme colors meet token-level contrast checks

- **GIVEN** light and dark theme tokens are defined
- **WHEN** theme contrast regression checks run
- **THEN** readable text token pairs meet WCAG AA 4.5:1 where they are used for normal text
- **AND** row-number, metadata-label, icon, focus, selected, and border token pairs meet at least 3:1 where they communicate UI structure or state
- **AND** active-control, accent-action, and danger-action foreground/background pairs meet their applicable contrast threshold in both themes.

## ADDED Requirements

### Requirement: General Preferences Organization

The system SHALL organize General preferences into compact, vertically scannable groups without changing immediate persistence.

#### Scenario: Interface settings are stacked

- **WHEN** the General preferences tab renders
- **THEN** language, appearance, and menu bar icon are shown as separate vertical setting rows in that order
- **AND** each row keeps its label, description, and control readable in Chinese and English.

#### Scenario: Behavior and main-window settings are grouped

- **WHEN** the General preferences tab renders
- **THEN** launch at login and auto paste appear in a startup-and-behavior group
- **AND** show logo and show item numbers appear in a main-window group
- **AND** the three groups are visually distinguishable through spacing and section labels rather than decorative cards.

#### Scenario: General setting changes remain immediate

- **WHEN** the user changes any General preference
- **THEN** the existing immediate apply and save flow runs
- **AND** no Save or Cancel action is introduced.
