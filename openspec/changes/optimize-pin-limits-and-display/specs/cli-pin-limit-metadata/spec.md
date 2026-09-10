## Purpose

Keep CLI pin operations aligned with desktop settings and provide optional capacity metadata without changing existing list JSON consumers or sensitive-content presentation rules.

## ADDED Requirements

### Requirement: CLI pin operations use the matching settings file
`mclip-cli pin` and `unpin` SHALL resolve settings next to the selected history file, preserve `--id` and `--index` selectors, and set the requested final pin state idempotently.

#### Scenario: Custom history location
- **GIVEN** `--history-path` points to a fixture whose neighboring settings file sets `maxPinnedItems` to 5
- **WHEN** pin runs with five already pinned entries
- **THEN** the next distinct pin fails at 5
- **AND** settings from the user's actual application directory are not read.

#### Scenario: Missing or malformed configuration
- **WHEN** the corresponding settings file is absent
- **THEN** the effective pin limit is 10
- **BUT WHEN** the file exists and cannot be read or parsed
- **THEN** pin/unpin and metadata list exit 1 with a safe configuration error, no stdout and no data mutation.

#### Scenario: At-cap CLI error
- **GIVEN** ten pins and limit 10
- **WHEN** `mclip-cli pin --id ID` targets a different unpinned entry
- **THEN** exit status is 1 and stdout is empty
- **AND** stderr is `mclip-cli: Pin limit reached (10/10). Unpin an item first or update settings.` followed by a newline
- **AND** the selected history file is unchanged.

#### Scenario: CLI error at the maximum configurable limit
- **WHEN** a new pin is rejected with max 20
- **THEN** stderr includes the actual current/max counts and advises unpinning
- **AND** does not suggest increasing the maximum.

#### Scenario: Stable final state and selector semantics
- **WHEN** pin is repeated for an already pinned ID or unpin for an already unpinned ID
- **THEN** it succeeds without toggling the opposite state or changing timestamps
- **AND** `--index` retains the full canonical history order including pins, as shown by CLI list.

#### Scenario: Pure commands remain independent of configuration
- **GIVEN** unreadable or invalid history and settings files
- **WHEN** help, version, transform help or a valid transform command runs
- **THEN** neither history nor settings is read for that operation.

### Requirement: Opt-in JSON pin metadata
`list --json --with-meta` and `list --format json --with-meta` SHALL return `{ meta: { pinnedCount, maxPinnedItems }, data }`, with global counts for the selected history file and the existing filtered entry representation in data.

#### Scenario: Metadata ignores presentation filters
- **GIVEN** the selected history has three pins, a cap of 10 and multiple kinds
- **WHEN** list runs with JSON metadata and a limit or kind filter
- **THEN** meta remains `{ "pinnedCount": 3, "maxPinnedItems": 10 }`
- **AND** data follows existing filtering, canonical ordering and limit rules.

#### Scenario: Empty or over-cap history
- **WHEN** metadata is requested for empty history
- **THEN** pinnedCount is 0 and data is an empty array
- **BUT WHEN** valid legacy history contains 30 pins at effective cap 10
- **THEN** meta reports 30 and 10 without clamping the count or truncating stored history.

#### Scenario: Existing JSON remains compatible
- **WHEN** `list --json` runs without `--with-meta`
- **THEN** it returns the existing top-level array and does not add a settings-file dependency
- **AND** get/search/context/agent and mutation output structures retain their existing contracts, including Agent schema 2.

#### Scenario: Preserve entry fields and sensitive masking
- **WHEN** JSON metadata contains text, image, file or classified sensitive entries
- **THEN** data retains existing camelCase fields, kind-specific payloads, isPinned and pinnedAt
- **AND** classified text remains masked unless the same explicit reveal option accepted by list is present
- **AND** metadata introduces no clipboard contents or private file paths.

#### Scenario: Invalid metadata option combination
- **WHEN** `--with-meta` is passed without a JSON list format or to another command
- **THEN** the command exits 2 with usage feedback and no history mutation.
