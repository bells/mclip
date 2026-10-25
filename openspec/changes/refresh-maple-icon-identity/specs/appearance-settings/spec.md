## ADDED Requirements

### Requirement: Consistent maple application identity
The application SHALL use the selected rounded russet maple leaf with a flowing lowercase m cutout as its current desktop application icon and static website brand mark. The background and m cutout SHALL remain transparent.

#### Scenario: Current brand entrypoints
- **WHEN** the user views the application icon, main-window brand, About icon, or current website logo/favicon
- **THEN** each uses the selected maple identity
- **AND** versioned historical videos and screenshots retain their original contents.

### Requirement: Compatible maple tray choices
The application SHALL preserve the three existing tray settings values and the default selection, displaying color maple, monochrome maple, and the existing notebook with m as distinct choices in Chinese, English and Japanese.

#### Scenario: Existing saved tray choice
- **WHEN** settings containing `appIcon`, `light`, or `m` are loaded
- **THEN** the selection and all other preferences are retained
- **AND** `appIcon` shows the color maple, `light` shows the matching monochrome maple, and `m` shows the unchanged notebook.

#### Scenario: Platform contrast
- **WHEN** the monochrome maple is shown on macOS
- **THEN** native template rendering controls its color
- **AND** Windows and Linux use a contrasting derivative of the same selected silhouette.

#### Scenario: Small icon rendering
- **WHEN** the maple is rendered at the supported menu-bar sizes on light or dark surfaces
- **THEN** the leaf and its m cutout remain visually distinguishable without an opaque canvas or stray foreground patches.
