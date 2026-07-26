## MODIFIED Requirements

### Requirement: Public Installer Uses Prebuilt Binaries

The public one-command CLI installer SHALL prefer checksum-verified prebuilt binaries for supported platforms.

#### Scenario: Supported platform install

- **GIVEN** the user is on a supported OS and CPU architecture
- **AND** the release provides a matching `mclip-cli` binary asset and companion SHA-256 asset
- **WHEN** the user runs the public install script
- **THEN** the script downloads the matching binary and checksum
- **AND** verifies the binary before installation
- **AND** installs it into the user-level install directory
- **AND** does not require Rust, Cargo, or Git.

#### Scenario: Latest published version install

- **GIVEN** the user does not request a specific CLI version
- **WHEN** the public install script resolves a prebuilt asset
- **THEN** it selects the latest published non-prerelease Release
- **AND** installs the CLI asset and checksum from that same Release.

#### Scenario: Pinned version install

- **GIVEN** the user sets `MCLIP_VERSION` to a semantic version
- **WHEN** the public install script resolves a prebuilt asset
- **THEN** it downloads the binary and checksum from tag `v<MCLIP_VERSION>`
- **AND** does not silently substitute a different version.

#### Scenario: Downloaded checksum does not match

- **GIVEN** a prebuilt binary downloads
- **AND** its calculated SHA-256 digest does not match the release checksum
- **WHEN** the public installer validates it
- **THEN** installation fails with an integrity error
- **AND** the destination executable is not replaced.

#### Scenario: Checksum asset is unavailable

- **GIVEN** a prebuilt binary exists but its companion checksum cannot be downloaded or parsed
- **WHEN** the public installer validates it
- **THEN** installation fails closed
- **AND** does not install the unverified binary.

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

## ADDED Requirements

### Requirement: Release Publishes CLI Integrity Assets

Each published prebuilt `mclip-cli` binary SHALL have release-provided SHA-256 integrity data that installers can retrieve independently of the binary.

#### Scenario: CLI asset is prepared

- **WHEN** the Release workflow builds a CLI binary asset
- **THEN** it calculates that exact file's SHA-256 digest
- **AND** creates a companion checksum asset using the agreed asset naming and format.

#### Scenario: CLI assets are uploaded

- **WHEN** the Release workflow uploads a CLI binary
- **THEN** it uploads the matching checksum asset to the same Release
- **AND** the installer mapping contains only platform and architecture combinations the workflow can publish.

### Requirement: Release Version Alignment

The Release workflow SHALL reject a release when product manifests, the Git tag, or the built CLI report different versions.

#### Scenario: Version sources match

- **GIVEN** the Git tag, root package, website package, Cargo package, relevant lockfiles, and built CLI output contain the same semantic version
- **WHEN** Release validation runs
- **THEN** CLI and desktop artifacts may proceed to upload.

#### Scenario: Manifest version differs

- **GIVEN** any required product manifest or lockfile version differs from the Git tag
- **WHEN** Release validation runs
- **THEN** the workflow fails before publishing artifacts
- **AND** identifies the mismatched version source.

#### Scenario: Built CLI version differs

- **GIVEN** the built `mclip-cli --version` output does not match the Git tag
- **WHEN** Release validation runs
- **THEN** the workflow fails before uploading the CLI binary or checksum.
