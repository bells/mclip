## ADDED Requirements

### Requirement: Copy accepts one explicit input source
`mclip-cli copy` SHALL accept exactly one history selector or stdin source and SHALL reject ambiguous combinations.

#### Scenario: Existing history selector
- **WHEN** the user runs `mclip-cli copy --id ENTRY_ID` or `--index N`
- **THEN** the selected stored entry is written to the system clipboard using existing semantics.

#### Scenario: Piped stdin
- **WHEN** non-terminal stdin is piped to `mclip-cli copy` with no selector
- **THEN** the exact UTF-8 stdin text is written to the system clipboard
- **AND** it is not added directly to history by the CLI.

#### Scenario: Explicit stdin
- **WHEN** the user runs `mclip-cli copy --stdin`
- **THEN** the command reads stdin as its input source
- **AND** returns a clipboard-write action result after success.

#### Scenario: Ambiguous selector and stdin
- **WHEN** a history selector and stdin mode are supplied together
- **THEN** the command returns usage on stderr
- **AND** exits non-zero
- **AND** does not write the clipboard.

#### Scenario: No source on terminal
- **WHEN** `mclip-cli copy` has no selector, no `--stdin`, and terminal stdin
- **THEN** it returns usage without blocking for input.

### Requirement: Composable transform command
`mclip-cli transform <action>` SHALL read exactly one text input source and SHALL write only transformed content to stdout on success.

#### Scenario: Transform piped JSON
- **WHEN** valid JSON is piped to `mclip-cli transform json-prettify`
- **THEN** stdout contains only prettified JSON
- **AND** the command does not read or modify history or the system clipboard
- **AND** exits with status `0`.

#### Scenario: Transform explicit text
- **WHEN** the user supplies `--text TEXT` to a transform action
- **THEN** that text is the sole input source
- **AND** stdout contains only transformed content.

#### Scenario: Transform validation failure
- **WHEN** transform input is invalid for the selected action
- **THEN** stdout is empty
- **AND** a content-free diagnostic is written to stderr
- **AND** the command exits non-zero.

#### Scenario: Multiple transform sources
- **WHEN** more than one of `--text`, `--stdin`, or piped stdin is selected
- **THEN** the command returns usage
- **AND** performs no transformation.

### Requirement: Pipeline help and Agent contract
Pipeline help SHALL be history-independent, and Agent capability output SHALL identify new commands and their mutation boundaries.

#### Scenario: Transform help with missing history
- **GIVEN** the configured history file is absent or invalid
- **WHEN** the user runs `mclip-cli transform --help`
- **THEN** usage is printed
- **AND** the command exits `0` without reading history.

#### Scenario: Agent capability metadata
- **WHEN** `mclip-cli agent --json` returns command metadata
- **THEN** it identifies `transform` as history/clipboard read-free
- **AND** identifies copy stdin mode as a system-clipboard write
- **AND** does not imply that either command uploads content.
