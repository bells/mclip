## ADDED Requirements

### Requirement: Compact Preferences Window Bounds

The system SHALL present Preferences in a fixed, compact desktop window sized for vertically grouped settings.

#### Scenario: Preferences opens at compact fixed size

- **WHEN** the Preferences window opens
- **THEN** its logical size is approximately 600 pixels wide and 480 pixels high
- **AND** its minimum and maximum bounds keep that fixed size
- **AND** the content area scrolls when localized or permission text exceeds the available height.

#### Scenario: Fixed dialog controls stay unavailable

- **WHEN** the compact Preferences status bar renders
- **THEN** its minimize and maximize controls remain visibly unavailable
- **AND** the close control continues to work
- **AND** only the status bar drag region can move the window.
