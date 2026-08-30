## ADDED Requirements

### Requirement: Fixed Settings Center Window Bounds

The system SHALL present the two-column Preferences settings center in a fixed desktop window sized for navigation and readable setting rows.

#### Scenario: Preferences opens at settings-center size

- **WHEN** the Preferences auxiliary window is created
- **THEN** its logical size is approximately 820 pixels wide and 600 pixels high
- **AND** its minimum and maximum bounds keep that fixed size
- **AND** it remains focusable and is created through the existing auxiliary-window ready protocol.

#### Scenario: Fixed window controls remain accurate

- **WHEN** the Preferences status bar renders
- **THEN** minimize and maximize controls remain visibly unavailable
- **AND** the close control hides Preferences
- **AND** the control cluster remains on the platform-preferred side.

#### Scenario: Long preferences content

- **WHEN** localized copy, capability status, or CLI details exceed the content column height
- **THEN** the content column scrolls without moving the sidebar search or native-style status bar
- **AND** text wraps or scrolls within its bounded row without increasing the native window size.

#### Scenario: Drag boundary remains unchanged

- **WHEN** the user drags from the status bar's non-interactive region
- **THEN** the Preferences window moves
- **AND** dragging from sidebar search, navigation, settings rows, or page content does not start a native window drag.
