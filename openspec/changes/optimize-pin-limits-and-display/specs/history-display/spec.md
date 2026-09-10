## ADDED Requirements

### Requirement: Pin markers and independent ordinary row numbering
The main list SHALL show a passive Pin icon in pinned rows' leading number slot and SHALL number matching ordinary rows independently from 1. Markers SHALL NOT act as additional pin buttons or change row selection semantics.

#### Scenario: Mixed main list
- **GIVEN** three pinned and ten ordinary entries match the current query
- **WHEN** the main list displays ten ordinary entries with numbering enabled
- **THEN** the three pinned rows show Pin icons without numbers or letter labels
- **AND** ordinary rows display 1 through 10
- **AND** one compact divider separates the sections without section titles.

#### Scenario: Numbers disabled
- **WHEN** the user disables history item numbers
- **THEN** ordinary numbers are hidden while pinned state icons remain visible
- **AND** row height, click behavior and keyboard selection remain unchanged.

#### Scenario: Search changes matching entries
- **WHEN** a search produces matching pins and a subset of ordinary entries
- **THEN** nonmatching entries are excluded and ordinary matches restart at 1
- **AND** canonical order and stable IDs remain unchanged.

#### Scenario: Only one section matches
- **WHEN** all visible matches are pinned or all are ordinary
- **THEN** no pin-to-ordinary divider appears
- **AND** an all-pinned list has no numeric selection targets.

#### Scenario: Archive display remains independent
- **GIVEN** any number of pinned entries
- **WHEN** ordinary history is grouped beyond the main ordinary item count
- **THEN** pins do not count toward group ranges or appear again in group previews
- **AND** each group preview continues numbering locally from 1.

#### Scenario: Marker accessibility and visual treatment
- **WHEN** pinned rows render in light or dark appearance
- **THEN** the compact passive icon is distinguishable from the background and pinned status has an accessible label
- **AND** the existing detail header remains the location for pin/unpin controls.

### Requirement: Numeric quick selection targets visible ordinary history
Unmodified digit keys SHALL select ordinary main-list items using the same filtered positions as displayed numbers: 1..9 for positions 1..9 and 0 for position 10. Selection SHALL follow the existing copy, auto-paste and dismissal preferences.

#### Scenario: Pins do not offset the shortcut
- **GIVEN** three pinned rows precede ordinary rows and keyboard focus is outside text editing
- **WHEN** 1 is pressed in main-list mode
- **THEN** the first matching ordinary row is selected rather than the first pinned row.

#### Scenario: Tenth entry or no target
- **WHEN** 0 is pressed with ten visible ordinary entries
- **THEN** the tenth ordinary entry is selected
- **BUT WHEN** fewer than ten ordinary entries are visible
- **THEN** the event is not consumed and nothing is copied.

#### Scenario: Protect editing and existing keyboard modes
- **WHEN** a digit occurs in an input, textarea, contenteditable region or IME composition, is a repeated key event, includes any modifier, or occurs while a confirmation or group keyboard mode is active
- **THEN** numeric quick selection does not run or suppress the existing input behavior.

#### Scenario: Hidden numbers and extended navigation
- **WHEN** row numbers are hidden or more than ten ordinary entries are displayed
- **THEN** numeric mapping for the first ten ordinary entries remains the same
- **AND** directions and Enter continue traversing and selecting pinned rows, ordinary rows, groups and footer actions in visible order
- **AND** no letter shortcuts or multi-digit sequence is introduced.
