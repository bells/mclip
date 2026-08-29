## ADDED Requirements

### Requirement: Deterministic shared text transformations
The desktop and CLI SHALL use one Rust transformation contract for JSON prettify/minify, Base64 encode/decode, and URL component encode/decode.

#### Scenario: JSON prettify
- **GIVEN** input is a valid JSON value
- **WHEN** `jsonPrettify` runs
- **THEN** output is deterministic indented UTF-8 JSON
- **AND** reparsing output yields the same JSON value.

#### Scenario: JSON minify
- **GIVEN** input is a valid JSON value
- **WHEN** `jsonMinify` runs
- **THEN** output is deterministic compact UTF-8 JSON.

#### Scenario: Base64 round trip
- **GIVEN** input is UTF-8 text
- **WHEN** it is encoded and then decoded
- **THEN** the standard RFC 4648 padded Base64 operations reproduce the original text exactly.

#### Scenario: Base64 decodes non-UTF-8 bytes
- **GIVEN** valid Base64 input decodes to non-UTF-8 bytes
- **WHEN** `base64Decode` runs as a text action
- **THEN** it returns a typed non-UTF-8 error
- **AND** does not emit replacement text.

#### Scenario: URL component round trip
- **GIVEN** input is UTF-8 component text
- **WHEN** URL component encode and decode run in sequence
- **THEN** the original text is reproduced
- **AND** the operation does not reinterpret the input as a complete URL.

### Requirement: Text-only action applicability
Quick actions SHALL appear only for text entries and SHALL expose decode/JSON actions only when bounded validation determines they are applicable.

#### Scenario: Image or files entry
- **WHEN** an image or files entry detail is displayed
- **THEN** no text quick action is offered.

#### Scenario: Invalid JSON
- **GIVEN** a text entry is not valid JSON
- **WHEN** action applicability is calculated
- **THEN** JSON prettify and minify are not offered.

#### Scenario: Valid UTF-8 Base64
- **GIVEN** a text entry is valid standard Base64 whose decoded bytes are UTF-8
- **WHEN** action applicability is calculated
- **THEN** Base64 decode is offered.

### Requirement: Non-destructive quick-action flow
Running a desktop quick action SHALL create an in-memory result preview and SHALL NOT mutate history until the user explicitly copies or confirms replacement.

#### Scenario: Preview result
- **WHEN** a user runs an applicable action
- **THEN** mclip displays the transformed result without expanding the main window
- **AND** history, clipboard, and revision remain unchanged.

#### Scenario: Copy result
- **WHEN** the user chooses Copy in the result surface
- **THEN** mclip writes the transformed text to the system clipboard
- **AND** normal clipboard watcher and dedupe behavior applies.

#### Scenario: Confirm replacement
- **GIVEN** the result preview targets an existing text entry
- **WHEN** the user confirms Replace
- **THEN** the entry keeps its stable ID and pin metadata
- **AND** its text, display, dedupe, and sensitivity metadata are recomputed
- **AND** one revisioned upsert is emitted.

#### Scenario: Cancel result
- **WHEN** the user cancels or closes the result surface
- **THEN** the transformed result is discarded
- **AND** history remains unchanged.

### Requirement: Bounded transformation resources
Every transformation SHALL enforce symmetric documented input/output byte limits and SHALL return typed errors without logging content.

#### Scenario: Input exceeds limit
- **WHEN** transform input exceeds the configured input byte limit
- **THEN** the operation fails before parsing or encoding
- **AND** returns a size-limit error with byte counts only.

#### Scenario: Output exceeds limit
- **WHEN** a transformation would exceed the output byte limit
- **THEN** it returns an output-limit error
- **AND** does not send partial output across IPC.

#### Scenario: Invalid encoded input
- **WHEN** Base64 or percent-decoding input is invalid
- **THEN** the operation returns a stable validation error
- **AND** does not include the input in logs, telemetry, or the error message.
