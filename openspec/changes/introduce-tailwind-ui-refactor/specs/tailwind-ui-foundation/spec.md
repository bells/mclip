## ADDED Requirements

### Requirement: Tailwind Styling Foundation
The frontend SHALL use Tailwind utility classes and a thin Tailwind entrypoint as the styling foundation for mclip application windows.

#### Scenario: Tailwind entrypoint owns global styling
- **WHEN** the frontend app starts
- **THEN** `src/main.tsx` imports the new Tailwind styling entrypoint
- **AND** the imported entrypoint includes Tailwind and shared theme/base primitives only
- **AND** the app does not import `src/App.css`.

#### Scenario: Legacy component stylesheet removed
- **WHEN** the Tailwind migration is complete
- **THEN** `src/App.css` no longer exists in the repository
- **AND** React components no longer rely on legacy `app-*` component selectors for visual styling
- **AND** any remaining non-Tailwind CSS is limited to base primitives that cannot be expressed safely as component utilities.

#### Scenario: Reusable styling remains utility-backed
- **WHEN** repeated visual patterns are extracted for maintainability
- **THEN** the extraction expands to Tailwind utility classes or theme tokens
- **AND** it does not recreate a large global component selector layer.

### Requirement: Viewport-Bounded Main Window Shell
The main window SHALL use a Tailwind-owned flex layout that prevents body height collapse and uncontrolled nested scrolling.

#### Scenario: Main shell fills the Tauri window
- **WHEN** the `main` window renders
- **THEN** its outer shell fills the viewport height
- **AND** the shell uses a vertical flex layout
- **AND** the shell clips overflow at the window boundary.

#### Scenario: History content scrolls without moving header or footer
- **GIVEN** the configured main item count is larger than the visible area
- **WHEN** the main window renders history items
- **THEN** the header remains visible
- **AND** the footer actions remain visible
- **AND** the history content region scrolls vertically inside the flex shell.

#### Scenario: App body does not create stray scrollbars
- **WHEN** the main window contains search, history rows, archive group rows, modal state, and footer actions
- **THEN** horizontal overflow is not introduced
- **AND** vertical scrolling is owned by the intended history region
- **AND** the app body does not collapse to zero height.

### Requirement: Minimalist OLED Theme Tokens
The Tailwind foundation SHALL define coherent tokens for mclip's Developer Tool / Minimalist UI visual direction.

#### Scenario: OLED dark theme
- **GIVEN** the resolved appearance theme is dark
- **WHEN** any mclip frontend window renders
- **THEN** surfaces use near-black dark backgrounds with readable foreground text
- **AND** soft shadows or borders separate layers without decorative glow effects
- **AND** focus and selected states remain visible.

#### Scenario: Readable light theme
- **GIVEN** the resolved appearance theme is light
- **WHEN** any mclip frontend window renders
- **THEN** text, icons, borders, row numbers, metadata labels, and controls remain readable
- **AND** local surfaces protect content from desktop wallpaper bleed
- **AND** the palette avoids washed-out beige, cream, or one-note tinting.

#### Scenario: Theme parity across windows
- **WHEN** the active theme changes between system, light, and dark
- **THEN** `main`, `preview`, `preview-detail`, `about`, and `preferences` use the same semantic token family
- **AND** no window keeps old CSS colors that conflict with the resolved theme.

### Requirement: Independent Window Styling Parity
The Tailwind migration SHALL preserve mclip's existing Tauri window model and cross-window preview behavior.

#### Scenario: Preview remains outside the main DOM
- **WHEN** a history item preview or archive group preview opens
- **THEN** preview content renders in the existing `preview` or `preview-detail` Tauri windows
- **AND** the main window is not widened to contain preview content
- **AND** preview windows remain non-focusable.

#### Scenario: Preview interaction model is preserved
- **WHEN** the user moves between the main window, group preview, and preview-detail surfaces
- **THEN** hover highlighting and detail display continue to follow the existing cross-window pointer model
- **AND** selecting or deleting history items does not reopen stale preview content.

#### Scenario: Dialog chrome keeps explicit drag regions
- **WHEN** About or Preferences renders with Tailwind classes
- **THEN** the status/title bar remains the only non-control drag region
- **AND** content area interactions do not start window dragging
- **AND** fixed dialog sizing remains stable.

### Requirement: Accessible Interaction States
The Tailwind UI foundation SHALL preserve visible, accessible interaction states for the compact desktop interface.

#### Scenario: Keyboard focus remains visible
- **WHEN** keyboard navigation reaches search, history rows, archive group rows, footer actions, modal controls, dialog tabs, or preference controls
- **THEN** a visible focus indicator is shown
- **AND** the focused target remains scrolled into view when it is inside a scrollable region.

#### Scenario: Icon-only controls remain labelled
- **WHEN** an icon-only or visually compact control renders
- **THEN** it exposes an accessible name through visible text or ARIA
- **AND** disabled states are semantically disabled and visually distinct.

#### Scenario: Motion stays subtle
- **WHEN** hover, selected, pressed, modal, preview, or loading states change
- **THEN** transitions use short opacity, color, shadow, or transform changes
- **AND** reduced-motion user preferences are respected
- **AND** no decorative infinite animations are introduced.
