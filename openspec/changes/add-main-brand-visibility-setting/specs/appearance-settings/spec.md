## ADDED Requirements

### Requirement: Main Window Brand Visibility Setting

The system SHALL provide a setting that controls whether the main-window header brand block is displayed.

#### Scenario: Main window brand is visible by default

- **GIVEN** no saved main-window brand visibility setting exists
- **WHEN** settings are loaded and the main window renders
- **THEN** the logo and `mclip` text to the left of the search field are displayed.

#### Scenario: Main window brand is hidden

- **GIVEN** main-window brand visibility is disabled
- **WHEN** the main window renders
- **THEN** the logo and `mclip` text to the left of the search field are not displayed
- **AND** the search field uses the freed header space without leaving an empty brand column.

#### Scenario: Main window brand visibility can be changed in General preferences

- **GIVEN** the Preferences window is open on the General tab
- **WHEN** the user changes the main-window brand visibility setting
- **THEN** the setting is saved through the existing app settings model
- **AND** the next main-window render follows the saved value.

#### Scenario: Disabled main window brand visibility persists

- **GIVEN** main-window brand visibility is disabled and saved
- **WHEN** settings are loaded again
- **THEN** the disabled value is preserved rather than normalized back to visible.
