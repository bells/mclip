## ADDED Requirements

### Requirement: Synchronized Main Window Active Highlight

The system SHALL maintain exactly one active highlight across the main-window search box, visible history rows, archive group rows, and enabled footer actions, regardless of whether the active target was chosen by keyboard or pointer movement.

#### Scenario: Search is active when the main window appears

- **WHEN** the main window first mounts or is shown again from the tray, menu bar, or global shortcut
- **THEN** the search box is focused and visibly highlighted as the active target
- **AND** the search highlight uses its selected border and surface without an additional outer ring
- **AND** no history row, archive group row, or footer action is simultaneously shown as active.

#### Scenario: Arrow keys move the single highlight in visible order

- **GIVEN** a main-window target is active
- **WHEN** the user presses Arrow Down or Arrow Up
- **THEN** the active highlight moves to the next or previous available target in visible UI order using the existing wrap behavior
- **AND** the previous target loses its active highlight
- **AND** the newly active target scrolls into view when necessary.

#### Scenario: Pointer movement takes over the active highlight

- **GIVEN** one main-window target is active
- **WHEN** the user moves the pointer onto a different navigable main-window target
- **THEN** that pointer target becomes the sole active highlight
- **AND** the previously active target loses its active highlight
- **AND** a disabled target cannot become active.

#### Scenario: Keyboard navigation continues from the pointer target

- **GIVEN** pointer movement most recently activated a main-window target
- **WHEN** the user presses Arrow Down or Arrow Up
- **THEN** navigation continues from that pointer-activated target
- **AND** the resulting target becomes the sole active highlight.

#### Scenario: Active highlight and preview stay synchronized

- **WHEN** a history row or archive group row becomes active by keyboard or pointer movement
- **THEN** the corresponding item or group preview is shown and aligned to that active row
- **AND** activating search or an enabled footer action dismisses any stale history preview
- **AND** the preview and preview-detail windows remain non-focusable.

#### Scenario: Removed active target falls back to search

- **GIVEN** the active target is removed from the rendered target list by filtering, deletion, or a history refresh
- **WHEN** the main window reconciles its available navigation targets
- **THEN** the search box becomes the sole active highlight
- **AND** subsequent Arrow Up or Arrow Down navigation starts from search.
