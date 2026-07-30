## ADDED Requirements

### Requirement: Deterministic Missing-Asset Recovery

The public installer SHALL classify a completed HTTP response by its final status independently from curl's transport exit-code convention and SHALL preserve the existing CLI on every unsuccessful prebuilt attempt.

#### Scenario: Latest published Release has no matching binary

- **GIVEN** the latest published Release returns final HTTP status `404` for the current platform's CLI binary
- **WHEN** the public installer attempts the prebuilt download
- **THEN** it reports that the prebuilt asset is missing
- **AND** enters the documented local/source-build fallback
- **AND** does not treat the missing asset as an installable binary.

#### Scenario: Curl reports a nonstandard exit code with final 404

- **GIVEN** curl exposes final HTTP status `404`
- **AND** the environment reports a curl exit code other than `22`
- **WHEN** the installer classifies the prebuilt request
- **THEN** it still treats the response as a missing asset
- **AND** attempts the documented fallback path.

#### Scenario: Transport fails without a completed HTTP response

- **GIVEN** the CLI download is interrupted or no trustworthy final HTTP response is received
- **WHEN** the installer classifies the request
- **THEN** it reports a transport failure
- **AND** does not replace the existing CLI.

#### Scenario: Binary exists but checksum is missing

- **GIVEN** the binary request succeeds
- **AND** the companion checksum cannot be downloaded or validated
- **WHEN** the installer verifies the prebuilt asset
- **THEN** installation fails closed
- **AND** it does not install the unverified binary
- **AND** the existing CLI is preserved.

### Requirement: Published CLI Installability Gate

The Release process SHALL expose a failing readiness result unless every supported prebuilt CLI binary and its matching checksum are present and retrievable from the same draft Release.

#### Scenario: Complete supported asset set

- **GIVEN** the macOS ARM64 and Windows x64 CLI jobs have completed
- **WHEN** release readiness is evaluated
- **THEN** the draft Release contains each expected CLI binary
- **AND** contains each binary's `.sha256` companion
- **AND** local checksum validation has succeeded before upload.

#### Scenario: Checksum path is unmatched during upload

- **GIVEN** a workflow upload path for a required CLI checksum does not resolve to a file
- **WHEN** the upload step runs
- **THEN** the workflow fails
- **AND** does not report the Release run as ready.

#### Scenario: Remote draft is incomplete

- **GIVEN** any expected CLI binary or checksum is absent from the draft Release
- **WHEN** the post-platform readiness job queries the Release assets
- **THEN** the workflow fails with the missing asset names
- **AND** the Release is not considered ready for manual publication.

### Requirement: Version Command Regression Coverage

The CLI distribution checks SHALL execute the packaged CLI version entry points without requiring clipboard history.

#### Scenario: Long version flag regression

- **WHEN** automated CLI checks run `mclip-cli --version` with a nonexistent history path
- **THEN** the command prints `mclip-cli <package-version>`
- **AND** exits with status `0`.

#### Scenario: Version aliases regression

- **WHEN** automated CLI checks run `mclip-cli -V` and `mclip-cli version`
- **THEN** each command prints the same package version
- **AND** exits with status `0`.
