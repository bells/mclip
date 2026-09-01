## ADDED Requirements

### Requirement: Notebook m Menu Bar Artwork

The system SHALL represent the existing `m` menu-bar icon style with a compact monochrome notebook containing a recognizable lowercase `m`.

#### Scenario: Redesigned m icon is rendered

- **GIVEN** `menuBarIconStyle` is `m`
- **WHEN** mclip renders the menu-bar or system-tray icon
- **THEN** the foreground geometry presents a rounded notebook/page outline with restrained top-binding detail
- **AND** a lowercase `m` is visibly separated inside the notebook
- **AND** the result does not fall back to the previous standalone handwritten letter.

#### Scenario: Icon is reduced to status-item sizes

- **WHEN** the canonical icon is rasterized at 16×16, 18×18, and 22×22 reference sizes
- **THEN** the notebook silhouette and lowercase `m` remain separately recognizable
- **AND** no foreground geometry is clipped by the canvas
- **AND** the icon retains balanced transparent padding.

#### Scenario: Runtime and Preferences use the same design

- **WHEN** the `m` option is displayed in Preferences and applied to the native tray
- **THEN** both surfaces use derivatives of the same canonical notebook-with-`m` source
- **AND** the Preferences option has a localized accessible description in Chinese, English, and Japanese that identifies the notebook-with-`m` design.

#### Scenario: Existing setting remains compatible

- **GIVEN** a saved settings file contains `menuBarIconStyle: "m"`
- **WHEN** the redesigned asset is installed
- **THEN** the value remains valid without migration
- **AND** selecting the option continues to save immediately through the existing settings flow.

### Requirement: Monochrome Status Icon Asset

The notebook-with-`m` source SHALL use a transparent canvas and monochrome foreground geometry suitable for status-item rendering without gradients, shadows, or font dependencies.

#### Scenario: Asset contract is validated

- **WHEN** the focused icon asset checks run
- **THEN** the canonical source and the 512×512 runtime and 128×128 Preferences derivatives exist
- **AND** the derivatives retain transparency and their required dimensions
- **AND** the source uses explicit vector geometry rather than a system font glyph.

## MODIFIED Requirements

### Requirement: macOS Template Menu Bar Icon

The system SHALL use native macOS template image behavior for the `light` and `m` menu-bar icon styles on macOS.

#### Scenario: Light icon on macOS

- **GIVEN** the app is running on macOS
- **AND** `menuBarIconStyle` is `light`
- **WHEN** the tray/menu bar icon is configured
- **THEN** the underlying `NSImage` is marked as a template image
- **AND** macOS can adapt its color to the menu bar appearance.

#### Scenario: Notebook m icon on macOS

- **GIVEN** the app is running on macOS
- **AND** `menuBarIconStyle` is `m`
- **WHEN** the tray/menu bar icon is configured
- **THEN** the redesigned notebook-with-`m` image is marked as a template image
- **AND** macOS can adapt its color to the menu bar appearance.

#### Scenario: Light icon on Windows

- **GIVEN** the app is running on Windows
- **AND** `menuBarIconStyle` is `light`
- **WHEN** the tray icon is configured
- **THEN** mclip uses the existing light icon asset without macOS-only template APIs.

#### Scenario: Notebook m icon on Windows

- **GIVEN** the app is running on Windows
- **AND** `menuBarIconStyle` is `m`
- **WHEN** the tray icon is configured
- **THEN** mclip uses the redesigned notebook-with-`m` asset without macOS-only template APIs.
