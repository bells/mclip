## ADDED Requirements

### Requirement: Compact Archive Group Navigation

The system SHALL render archive history group navigation with compact, consistent vertical spacing while preserving the existing interaction target and preview behavior.

#### Scenario: Consecutive archive groups

- **GIVEN** the main window contains at least two archive group rows
- **WHEN** the archive group navigation renders
- **THEN** consecutive group rows have no extra decorative vertical gap between their row boxes
- **AND** each row retains the existing usable button height and horizontal alignment.

#### Scenario: Compact row opens preview

- **GIVEN** archive group rows use the compact layout
- **WHEN** the user hovers, focuses, or activates a group row
- **THEN** the corresponding independent preview window opens for that group
- **AND** its anchor is measured from the rendered row position.

#### Scenario: Keyboard navigation through compact groups

- **GIVEN** multiple archive group rows are visible
- **WHEN** the user navigates between them with the keyboard
- **THEN** each group remains individually focusable
- **AND** the active row remains visibly distinguishable from adjacent rows.
