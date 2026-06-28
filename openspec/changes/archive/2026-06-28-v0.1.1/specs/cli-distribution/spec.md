# cli-distribution Specification

## ADDED Requirements

### Requirement: CLI Version Flag

The CLI SHALL provide a version command and flags.

#### Scenario: Long version flag

- **WHEN** the user runs `mclip-cli --version`
- **THEN** the CLI prints the mclip package version
- **AND** exits with status `0`
- **AND** does not require reading the history file.

#### Scenario: Short version flag

- **WHEN** the user runs `mclip-cli -V`
- **THEN** the CLI prints the mclip package version
- **AND** exits with status `0`.

#### Scenario: Version command

- **WHEN** the user runs `mclip-cli version`
- **THEN** the CLI prints the mclip package version
- **AND** exits with status `0`.

### Requirement: CLI Help Without History Access

The CLI SHALL print help without requiring clipboard history access.

#### Scenario: Top-level help

- **WHEN** the user runs `mclip-cli --help`
- **THEN** the CLI prints usage
- **AND** exits with status `0`
- **AND** does not require reading the history file.

#### Scenario: Command help

- **WHEN** the user runs `mclip-cli list --help`
- **THEN** the CLI prints usage for the CLI
- **AND** exits with status `0`.

### Requirement: Public Installer Uses Prebuilt Binaries

The public one-command CLI installer SHALL prefer downloading prebuilt binaries for supported platforms.

#### Scenario: Supported platform install

- **GIVEN** the user is on a supported OS and CPU architecture
- **AND** the release provides a matching `mclip-cli` binary asset
- **WHEN** the user runs the public install script
- **THEN** the script downloads the matching binary
- **AND** installs it into the user-level install directory
- **AND** does not require Rust, Cargo, or Git.

#### Scenario: Missing binary asset

- **GIVEN** no prebuilt binary asset matches the current platform
- **WHEN** the user runs the public install script
- **THEN** the script reports the missing asset clearly
- **AND** may offer the source-build fallback path if Git and Cargo are available.

#### Scenario: Installer path guidance

- **GIVEN** the CLI binary is installed successfully
- **AND** the install directory is not on `PATH`
- **WHEN** the install script completes
- **THEN** it prints the shell profile line needed to add the install directory to `PATH`.
