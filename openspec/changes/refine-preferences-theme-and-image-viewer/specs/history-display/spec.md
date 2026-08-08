## ADDED Requirements

### Requirement: History Preferences Organization

The system SHALL present clipboard retention and display-count controls under a History preferences tab in task order.

#### Scenario: History tab uses user-facing history terminology

- **WHEN** the preferences tab list renders in Chinese or English
- **THEN** the former Storage tab is labeled `历史` in Chinese and `History` in English
- **AND** existing settings data and internal persistence keys remain compatible.

#### Scenario: History settings follow task order

- **WHEN** the History preferences tab renders
- **THEN** saved content types appear first
- **AND** maximum records appears second
- **AND** main-window item count appears third
- **AND** archive-group item count appears fourth.

#### Scenario: History setting changes remain immediate

- **WHEN** the user changes a saved type or a valid numeric count
- **THEN** the existing immediate apply and save flow runs
- **AND** the page is not disabled while the background save is pending
- **AND** no Save or Cancel action is introduced.
