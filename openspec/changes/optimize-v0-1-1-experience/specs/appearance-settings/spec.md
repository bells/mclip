## ADDED Requirements

### Requirement: Inline General Selector Row

The Preferences General tab SHALL present Language, Appearance Theme, and Menu Bar Icon in one horizontal three-column layout, with a compact inline label-and-selector pair inside each column.

#### Scenario: General fields render

- **WHEN** the user opens the Preferences General tab
- **THEN** Language appears on the same row as its select
- **AND** Appearance Theme appears on the same row as its select
- **AND** Menu Bar Icon appears on the same row as its select
- **AND** all three field pairs share one horizontal three-column row
- **AND** the language and appearance selects are substantially shorter than their columns
- **AND** the menu bar icon selector is narrower still while retaining consistent control height and visual treatment.

#### Scenario: Menu bar icon options

- **WHEN** the user opens the Menu Bar Icon selector
- **THEN** it provides image-only visible options for `appIcon`, `light`, and `m`
- **AND** each image option retains a localized accessible name
- **AND** the current `menuBarIconStyle` is selected.

#### Scenario: General selector saves immediately

- **GIVEN** the Preferences General tab is open
- **WHEN** the user changes any of the three selects
- **THEN** the corresponding existing setting is saved through the current settings flow
- **AND** the selected value is reflected without a separate Save action.

#### Scenario: Menu bar icon pointer selection survives focus transition

- **GIVEN** the Menu Bar Icon dropdown is open
- **WHEN** the user clicks an image option and the WebView moves focus between dropdown controls
- **THEN** the option remains mounted long enough to commit its `menuBarIconStyle`
- **AND** the dropdown closes only after selection
- **AND** the native tray icon refreshes through the existing settings save flow.

#### Scenario: Keyboard and accessible labels

- **WHEN** the user navigates the General fields with a keyboard or assistive technology
- **THEN** the language and appearance selects remain focusable with native select behavior
- **AND** the menu bar icon dropdown supports opening, option traversal, selection, Escape dismissal, and focus return without closing the Preferences window
- **AND** each visible label is programmatically associated with its selector.
