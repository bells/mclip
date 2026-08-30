## MODIFIED Requirements

### Requirement: Public Installer Uses Prebuilt Binaries
The public one-command CLI installer SHALL prefer checksum-verified prebuilt binaries for supported platforms, including Linux x86_64, and SHALL preserve the existing binary if verification or replacement fails.

#### Scenario: Supported platform install
- **GIVEN** the user is on macOS ARM64, Windows x64 in a POSIX-compatible shell, or Linux x86_64
- **AND** the release provides a matching `mclip-cli` binary and `.sha256` asset
- **WHEN** the user runs the public install script
- **THEN** the script downloads the matching binary and checksum
- **AND** verifies SHA-256 before replacement
- **AND** installs it into the user-level install directory
- **AND** does not require Rust, Cargo, Git, `sudo`, or an external clipboard executable.

#### Scenario: Linux x86_64 asset mapping
- **GIVEN** `uname -s` is `Linux`
- **AND** `uname -m` is `x86_64` or `amd64`
- **WHEN** the installer detects the release asset
- **THEN** it selects `mclip-cli-linux-x64`.

#### Scenario: Unsupported Linux architecture
- **GIVEN** the host is Linux ARM64
- **AND** v0.2.0 has no advertised Linux ARM64 prebuilt asset
- **WHEN** the user runs the public install script
- **THEN** the script reports that no supported prebuilt asset exists
- **AND** may offer the source-build fallback if Git and Cargo are available
- **AND** does not download an x86_64 binary.

#### Scenario: Missing binary asset
- **GIVEN** no prebuilt binary asset matches the current platform
- **WHEN** the user runs the public install script
- **THEN** the script reports the missing asset clearly
- **AND** may offer the source-build fallback path if Git and Cargo are available.

#### Scenario: Checksum unavailable or invalid
- **GIVEN** the binary downloads but its checksum is missing, malformed, or mismatched
- **WHEN** the installer verifies the candidate
- **THEN** installation fails closed
- **AND** the existing CLI binary is preserved
- **AND** source fallback does not bypass the failed verification for that advertised asset.

#### Scenario: Candidate replacement fails
- **GIVEN** a verified candidate cannot replace the installed CLI
- **WHEN** the atomic installation step fails
- **THEN** the previous CLI is restored or left untouched
- **AND** the installer exits non-zero.

#### Scenario: Installer path guidance
- **GIVEN** the CLI binary is installed successfully
- **AND** the install directory is not on `PATH`
- **WHEN** the install script completes
- **THEN** it prints the shell profile line needed to add the install directory to `PATH`.
