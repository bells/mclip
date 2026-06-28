# dialog-window-chrome Specification

## Purpose

Define custom chrome behavior for the dedicated About and Preferences windows.

## Requirements

### Requirement: Dialog Status Bar

The system SHALL show a clear status/title bar in About and Preferences windows.

#### Scenario: Native-style dialog title bar

- **GIVEN** the About or Preferences window is open on macOS
- **WHEN** it renders
- **THEN** the top of the dialog shows a full-width native-style title bar inspired by the ztool dialog chrome
- **AND** the title bar uses a calm neutral surface with a subtle separator from the content area
- **AND** it is not rendered as a centered capsule, floating card, or decorative grab handle.

#### Scenario: Window controls and title alignment

- **GIVEN** the About or Preferences window is open
- **WHEN** the status/title bar renders
- **THEN** the window control cluster appears on the platform-preferred side
- **AND** on macOS the controls appear in the traffic-light order: close, minimize, maximize
- **AND** the window title sits on the same baseline after the control cluster on macOS
- **AND** the title identifies both the app and the dialog purpose, such as Preferences or About.

#### Scenario: Disabled dialog controls remain legible

- **GIVEN** a fixed-size dialog does not support minimize or maximize
- **WHEN** the status/title bar renders its window controls
- **THEN** the unsupported controls are visibly unavailable while preserving the three-control native rhythm
- **AND** unsupported controls do not start window actions
- **AND** the close control remains visually and interactively distinct.

#### Scenario: About status bar

- **GIVEN** the About window is open
- **WHEN** it renders
- **THEN** it shows a top status/title bar with native-style window controls and an About title for mclip
- **AND** the About content starts below the bar without overlapping the controls or title.

#### Scenario: Preferences status bar

- **GIVEN** the Preferences window is open
- **WHEN** it renders
- **THEN** it shows a top status/title bar with native-style window controls and a Preferences title for mclip
- **AND** the Preferences content starts below the bar without overlapping the controls or title.

#### Scenario: Theme-aware dialog title bar

- **GIVEN** the user switches between light, dark, and system appearance modes
- **WHEN** the About or Preferences window renders
- **THEN** the dialog title bar uses the active theme tokens
- **AND** the title, controls, separator, and surface remain readable in both light and dark themes.

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
