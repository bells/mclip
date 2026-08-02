## ADDED Requirements

### Requirement: Image details expose a fullscreen action
The system SHALL expose a fullscreen image action next to the delete action when a history detail displays an image.

#### Scenario: Single image detail shows the action
- **GIVEN** a single-item history preview displays an image entry
- **WHEN** the detail header renders
- **THEN** a bidirectional 45-degree diagonal expand icon button appears next to the delete button
- **AND** the button has a localized accessible name and tooltip describing fullscreen image viewing.

#### Scenario: Group hover image detail shows the action
- **GIVEN** an archive group hover detail displays an image entry
- **WHEN** the detail header renders
- **THEN** the same fullscreen image action appears next to the delete button.

#### Scenario: Non-image detail does not show the action
- **GIVEN** a history detail displays a text or files entry
- **WHEN** the detail header renders
- **THEN** no fullscreen image action is present
- **AND** the existing delete action and type metadata remain unchanged.

### Requirement: Fullscreen image viewer uses a dedicated window
The system SHALL display the selected history image in a dedicated, focusable Tauri window that enters fullscreen mode on the active display.

#### Scenario: Open image from history detail
- **GIVEN** an image history detail is visible
- **WHEN** the user activates the fullscreen image action
- **THEN** the undecorated `image-viewer` window enters same-display fullscreen mode without a native title bar
- **AND** it becomes visible and focused
- **AND** the main window, `preview`, and `preview-detail` windows are hidden.

#### Scenario: Existing preview focus behavior is preserved
- **WHEN** the fullscreen capability is configured
- **THEN** the `preview` and `preview-detail` windows remain non-focusable
- **AND** only the dedicated image viewer receives focus for fullscreen keyboard interaction.

#### Scenario: Viewer receives the first keyboard interaction
- **GIVEN** the image viewer is opening on macOS
- **WHEN** native fullscreen and frame updates temporarily race with the initial focus request
- **THEN** the system focuses both the host window and the WebView first responder
- **AND** it performs a bounded post-show focus reinforcement while the viewer remains visible
- **AND** the viewer accepts `Escape` without requiring a preliminary mouse click
- **AND** focus reinforcement stops once the viewer is hidden or the bounded opening interval ends.

#### Scenario: Image fills the available viewer without distortion
- **GIVEN** the image data loads successfully
- **WHEN** the fullscreen viewer renders the image
- **THEN** the image is centered within the available viewport
- **AND** its original aspect ratio is preserved
- **AND** the complete image remains visible without cropping or stretching.

### Requirement: Fullscreen viewer reports image loading state
The system SHALL provide explicit loading and failure states while resolving the selected image resource.

#### Scenario: Image is loading
- **GIVEN** the fullscreen viewer is visible
- **AND** the image resource has not finished loading
- **WHEN** the viewer renders
- **THEN** it shows a loading placeholder matching the image viewing region
- **AND** the close action remains available.

#### Scenario: Image fails to load
- **GIVEN** the selected image resource cannot be read or decoded
- **WHEN** loading fails
- **THEN** the viewer shows a localized failure message
- **AND** it does not show a broken image element
- **AND** the close action remains available.

### Requirement: Fullscreen viewer exits predictably
The system SHALL close the fullscreen viewer through an explicit close control or the `Escape` key and restore the main history window without reopening stale previews.

#### Scenario: Close with the viewer control
- **GIVEN** the fullscreen image viewer is open
- **WHEN** the user activates the close button
- **THEN** the viewer exits fullscreen and hides
- **AND** the main history window is restored at its previous position and focused
- **AND** no item or group detail preview is automatically reopened.

#### Scenario: Close with Escape
- **GIVEN** the fullscreen image viewer is focused
- **WHEN** the user presses `Escape`
- **THEN** the same close and main-window restoration behavior runs.

#### Scenario: Repeated close input is safe
- **GIVEN** viewer close is already in progress
- **WHEN** another close action or `Escape` input occurs
- **THEN** the system does not issue a second conflicting window transition
- **AND** the main history window is restored at most once.

### Requirement: Fullscreen entry invalidates stale preview work
The system SHALL invalidate pending preview-open work before showing the fullscreen image viewer.

#### Scenario: Pending detail request completes after fullscreen entry
- **GIVEN** an asynchronous preview update or show request is in flight
- **WHEN** the user opens the fullscreen image viewer
- **AND** the old request later completes
- **THEN** neither `preview` nor `preview-detail` becomes visible over the fullscreen viewer.

#### Scenario: Return from viewer resets preview dismissal safely
- **GIVEN** the fullscreen image viewer has hidden the preview family
- **WHEN** the viewer closes and the main window is restored
- **THEN** future deliberate hover or keyboard navigation can open a fresh preview
- **AND** no prior hover selection is restored automatically.
