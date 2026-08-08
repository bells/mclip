## ADDED Requirements

### Requirement: Image viewer uses a dedicated windowed surface

The system SHALL open history images in the dedicated, focusable `image-viewer` window without changing the non-focusable preview family.

#### Scenario: Open image as the maximized history detail

- **GIVEN** an image history detail is visible
- **WHEN** the user activates its image-viewer action
- **THEN** the dedicated viewer first establishes a centered normal frame of approximately 720 by 520 logical pixels and then opens maximized on the main window's current display
- **AND** it is visible and focused
- **AND** `preview` and `preview-detail` are hidden
- **AND** the main window remains visible at its existing position behind the viewer.

#### Scenario: Viewer reuses the complete history-detail structure

- **GIVEN** an image history detail is visible
- **WHEN** the dedicated viewer opens
- **THEN** it renders the shared history-detail header with the same kicker, content kind, and history position
- **AND** it renders the shared image content with proportional fitting and loading or error feedback
- **AND** it keeps the metadata section for source app, first copied time, last copied time, and copy count
- **AND** delete remains available alongside maximize or restore and close.

#### Scenario: Preview ownership remains unchanged

- **WHEN** windowed image viewing is configured
- **THEN** `preview` and `preview-detail` remain independent and non-focusable
- **AND** their anchor positioning, pointer hit testing, hover tracking, and request invalidation behavior remain unchanged
- **AND** the dedicated viewer reuses the shared history-detail components rather than maximizing either preview-family native window.

### Requirement: Image viewer maximizes and restores predictably

The system SHALL provide explicit controls for maximizing the viewer and restoring its normal window frame.

#### Scenario: Direct-open viewer is already maximized

- **WHEN** the user activates the image-viewer action from a history detail
- **THEN** the native viewer window opens maximized on its current display
- **AND** the title-bar control is immediately presented as a localized restore action.

#### Scenario: Restore viewer

- **GIVEN** the image viewer is maximized
- **WHEN** the user activates the restore control
- **THEN** the native viewer returns to its previous normal size and position
- **AND** the control changes back to a localized maximize action.

#### Scenario: Maximize restored viewer again

- **GIVEN** the image viewer has been restored to normal mode
- **WHEN** the user activates the maximize control
- **THEN** the native viewer window is maximized again
- **AND** the control changes to a localized restore action.

#### Scenario: Viewer cannot be minimized

- **WHEN** the image viewer window and controls are configured
- **THEN** no minimize action is exposed
- **AND** native minimization is disabled because the viewer is omitted from the taskbar.

### Requirement: Image viewer states remain complete

The system SHALL keep the complete image visible without distortion and provide explicit loading and failure feedback in both normal and maximized modes.

#### Scenario: Image loads successfully

- **WHEN** image data resolves
- **THEN** the complete image is centered within the available media region
- **AND** its original aspect ratio is preserved
- **AND** it is not cropped or stretched.

#### Scenario: Image is loading

- **WHEN** image data is still loading
- **THEN** the viewer shows a loading placeholder matching the media region
- **AND** maximize or restore and close controls remain available.

#### Scenario: Image fails to load

- **WHEN** image data cannot be read or decoded
- **THEN** the viewer shows a localized failure message instead of a broken image
- **AND** maximize or restore and close controls remain available.

### Requirement: Normal image detail reports loading failures

The system SHALL show lightweight image loading and failure feedback in a normal item detail without changing list-row dimensions.

#### Scenario: Detail image is loading

- **GIVEN** an image item detail is visible
- **WHEN** its image data is loading
- **THEN** the detail media area shows a compact loading placeholder
- **AND** metadata and detail actions remain available.

#### Scenario: Detail image fails

- **GIVEN** an image item detail is visible
- **WHEN** its image data fails to load
- **THEN** the detail media area shows a localized failure message
- **AND** no broken image element is rendered.

#### Scenario: List thumbnails stay stable

- **WHEN** an image thumbnail in the main list or archive preview is loading or fails
- **THEN** the existing row dimensions remain unchanged
- **AND** no detail-sized loading or error block is inserted into the list row.

### Requirement: Image viewer exits safely

The system SHALL close through the explicit close control or `Escape`, refocus the still-visible main window, and avoid reopening stale previews.

#### Scenario: Close from normal or maximized mode

- **WHEN** the user activates close or presses `Escape`
- **THEN** the viewer leaves any maximized state and hides
- **AND** the main window remains at its previous position and receives focus
- **AND** no item or group preview is automatically reopened.

### Requirement: Main window remains present during enlarged image detail

The system SHALL preserve the main window while the focusable viewer is open without weakening normal tray-popover dismissal.

#### Scenario: Viewer focus does not hide main

- **WHEN** the image viewer receives focus
- **THEN** the main window's focus-loss handler detects that the viewer is visible
- **AND** the main window is not hidden
- **AND** its position and content remain unchanged
- **AND** its tray-popover always-on-top level is temporarily lowered so the maximized viewer covers it.

#### Scenario: Viewer exit restores the main window layer

- **GIVEN** the viewer lowered the visible main window behind it
- **WHEN** the viewer closes or its open transition fails
- **THEN** the main window returns to its original always-on-top tray-popover level
- **AND** subsequent focus loss outside the preview family uses the existing automatic hide behavior.

#### Scenario: Normal focus loss still hides main

- **GIVEN** the image viewer is not visible
- **WHEN** the main window loses focus outside the preview family
- **THEN** the existing automatic main-window hide behavior still runs.

#### Scenario: Repeated close remains safe

- **GIVEN** viewer close is already in progress
- **WHEN** another close action or `Escape` occurs
- **THEN** no conflicting second window transition runs
- **AND** the main window is restored at most once.
