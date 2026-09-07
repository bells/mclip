## ADDED Requirements

### Requirement: Notebook m optical size

The existing notebook-with-m style SHALL use a larger effective foreground footprint than the pre-refinement artwork while retaining its recognizable notebook, binding, lowercase m, transparent padding, and native compatibility.

#### Scenario: Compare small reference sizes
- **WHEN** old and updated artwork are displayed at the same 16, 18, and 22 pixel reference sizes
- **THEN** the updated notebook and letter appear larger as a unit
- **AND** their strokes and negative spaces remain distinguishable without clipped foreground pixels
- **AND** both 1x actual-size and enlarged comparisons are recorded.

#### Scenario: Preview and runtime agree
- **WHEN** the user selects the existing m icon option
- **THEN** Preferences and the native tray display derivatives of the same updated artwork
- **AND** existing saved m preferences continue to work without migration.

#### Scenario: Native platform appearance
- **WHEN** the notebook icon is used on macOS
- **THEN** it retains native Template Image coloring and stable status-item positioning behavior

#### Scenario: Other platform appearance
- **WHEN** it is inspected on Windows or a supported Linux session
- **THEN** visibility and scale are evaluated using that platform's actual tray rendering
- **AND** macOS template behavior is not claimed as evidence for other platforms.

### Requirement: Consistent visual roles across desktop themes

All seven app windows SHALL maintain content hierarchy and interaction semantics in explicit light and dark appearance, using consistent roles for content, secondary text, active controls, metadata, and danger actions.

#### Scenario: Read text and controls in either theme
- **WHEN** main, preview, preview-detail, image-viewer, about, preferences, or quick-action renders in either theme
- **THEN** normal readable text, including meaningful help and metadata, meets at least 4.5:1 contrast against its composited background
- **AND** required non-text interactive boundaries and focus indicators meet at least 3:1
- **AND** busy wallpaper does not prevent reading the content.

#### Scenario: Distinguish interactive states
- **WHEN** a control is hovered, pressed, focused, selected, disabled, loading, or failed
- **THEN** its state is identifiable in both themes
- **AND** focus remains visible independently of pointer hover
- **AND** selected, busy, disabled, or failed states expose appropriate semantics or text instead of relying only on color.

#### Scenario: System appearance changes with multiple windows open
- **GIVEN** application appearance follows the system
- **WHEN** the OS switches light to dark or dark to light while app windows are open
- **THEN** all open app windows update to the same resolved theme without restart
- **AND** future auxiliary windows use that resolved theme.

#### Scenario: Explicit appearance stays explicit
- **GIVEN** application appearance is explicitly light or dark
- **WHEN** the OS changes appearance
- **THEN** app-rendered windows retain the explicit theme
- **AND** native menus and status-icon coloring continue to follow their platform conventions.

#### Scenario: Preserve compact desktop interaction
- **WHEN** the refined surfaces are used in a supported desktop session
- **THEN** the main window remains fixed at 320 pixels and preview windows remain independent
- **AND** controls remain operable at tested platform scaling levels without changing list density to a phone layout
- **AND** reduced-motion preferences suppress nonessential transitions.
