# dialog-window-chrome Specification

## ADDED Requirements

### Requirement: Dialog Status Bar

The system SHALL show a clear status/title bar in About and Preferences windows.

#### Scenario: About status bar

- **GIVEN** the About window is open
- **WHEN** it renders
- **THEN** it shows a top status/title bar with the window title, window controls, and concise app status such as version.

#### Scenario: Preferences status bar

- **GIVEN** the Preferences window is open
- **WHEN** it renders
- **THEN** it shows a top status/title bar with the window title, window controls, and concise settings context.

### Requirement: Explicit Dialog Drag Region

The system SHALL only start dragging About and Preferences windows from the status/title bar drag region.

#### Scenario: Drag from status bar

- **GIVEN** the pointer is over a non-interactive part of the dialog status/title bar
- **WHEN** the user presses and drags with the primary mouse button
- **THEN** the Tauri window drag starts.

#### Scenario: Drag from content

- **GIVEN** the pointer is over dialog content outside the status/title bar
- **WHEN** the user presses and drags with the primary mouse button
- **THEN** the Tauri window drag does not start.

#### Scenario: Interacting with controls in status bar

- **GIVEN** the pointer is over an interactive control inside the status/title bar
- **WHEN** the user presses the primary mouse button
- **THEN** the control interaction runs
- **AND** the Tauri window drag does not start.
