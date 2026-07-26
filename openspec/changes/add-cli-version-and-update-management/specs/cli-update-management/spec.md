## ADDED Requirements

### Requirement: Installed CLI Version Status

The system SHALL inspect the user-level `mclip-cli` executable and expose its installed version, the running desktop application's target version, and a deterministic update state without reading clipboard history.

#### Scenario: CLI is not installed

- **GIVEN** no regular executable exists at the user-level CLI install path
- **WHEN** CLI install status is requested
- **THEN** the state is `notInstalled`
- **AND** the installed version is absent
- **AND** the target version is the running desktop application's version.

#### Scenario: Installed CLI matches the desktop version

- **GIVEN** the installed CLI reports a valid semantic version equal to the running desktop application's version
- **WHEN** CLI install status is requested
- **THEN** the state is `current`
- **AND** both versions are returned through the typed status contract.

#### Scenario: Installed CLI is older

- **GIVEN** the installed CLI reports a valid semantic version lower than the running desktop application's version
- **WHEN** CLI install status is requested
- **THEN** the state is `outdated`
- **AND** the installed and target versions are returned.

#### Scenario: Installed CLI is newer

- **GIVEN** the installed CLI reports a valid semantic version higher than the running desktop application's version
- **WHEN** CLI install status is requested
- **THEN** the state is `newer`
- **AND** the installed and target versions are returned.

#### Scenario: Legacy CLI cannot report a version

- **GIVEN** a CLI file exists but `--version` exits unsuccessfully or returns malformed output
- **WHEN** CLI install status is requested
- **THEN** the state is `unknown`
- **AND** the status request succeeds with no installed version
- **AND** clipboard history is not read.

#### Scenario: Version probe does not exit

- **GIVEN** the installed executable does not finish its version probe within the configured timeout
- **WHEN** CLI install status is requested
- **THEN** the probe process is terminated and reaped
- **AND** the state is `unknown`
- **AND** Preferences remains responsive.

### Requirement: Version-Aware Preferences Actions

The Preferences CLI tab SHALL display installed and target CLI version information and SHALL derive its primary action from the reported update state.

#### Scenario: Install action for a missing CLI

- **GIVEN** CLI state is `notInstalled`
- **WHEN** the CLI tab renders
- **THEN** it shows the target version
- **AND** presents an Install action.

#### Scenario: Upgrade action for an outdated CLI

- **GIVEN** CLI state is `outdated`
- **WHEN** the CLI tab renders
- **THEN** it shows the installed and target versions
- **AND** presents an Upgrade action.

#### Scenario: Upgrade action for a legacy CLI

- **GIVEN** CLI state is `unknown`
- **WHEN** the CLI tab renders
- **THEN** it explains that the installed version cannot be identified
- **AND** presents an Upgrade action that can replace the legacy binary.

#### Scenario: Reinstall action for a current CLI

- **GIVEN** CLI state is `current`
- **WHEN** the CLI tab renders
- **THEN** it reports that the installed CLI is current
- **AND** presents a Reinstall action.

#### Scenario: Newer CLI is not downgraded implicitly

- **GIVEN** CLI state is `newer`
- **WHEN** the CLI tab renders
- **THEN** it reports that the installed CLI is newer than the desktop target
- **AND** does not start or recommend an automatic downgrade.

### Requirement: In-App Release Installation

The desktop application SHALL install or upgrade `mclip-cli` from the GitHub Release matching the running desktop application's exact version and the current supported OS and CPU architecture.

#### Scenario: Supported Release install without developer tools

- **GIVEN** the current platform has a published CLI asset for the desktop target version
- **AND** Rust, Cargo, and Git are not installed
- **WHEN** the user chooses Install or Upgrade in Preferences
- **THEN** the application downloads the exact versioned CLI asset through native HTTPS
- **AND** installs it into the user-level CLI directory
- **AND** does not invoke a shell, Cargo, or Git.

#### Scenario: Target Release is still unpublished

- **GIVEN** the target version only has a draft Release or its assets are not publicly downloadable
- **WHEN** the user chooses Install or Upgrade
- **THEN** the application reports that the target CLI Release is not published or available
- **AND** leaves any installed CLI unchanged.

#### Scenario: Platform asset is unsupported

- **GIVEN** the current OS and CPU architecture have no defined CLI Release asset
- **WHEN** CLI status is requested or installation is attempted
- **THEN** the status reports that in-app installation is unavailable for the platform
- **AND** Preferences does not start a download.

#### Scenario: Successful upgrade refreshes status

- **GIVEN** an outdated or unknown CLI is installed
- **WHEN** a verified target-version installation succeeds
- **THEN** the application probes the installed CLI again
- **AND** reports success only when the refreshed state is `current`.

### Requirement: Verified Recoverable CLI Replacement

The system SHALL verify release-published SHA-256 integrity data before replacing an installed CLI and SHALL preserve the previous executable whenever installation cannot complete.

#### Scenario: Downloaded asset matches its checksum

- **GIVEN** the binary and companion checksum asset download successfully
- **AND** the calculated SHA-256 digest matches the published digest
- **WHEN** installation proceeds
- **THEN** the verified binary replaces the destination executable
- **AND** receives executable permissions where required.

#### Scenario: Checksum is missing or malformed

- **GIVEN** the binary downloads but its companion checksum is missing or malformed
- **WHEN** installation validates the download
- **THEN** installation fails closed
- **AND** the downloaded binary is not installed
- **AND** the previous executable remains usable.

#### Scenario: Checksum does not match

- **GIVEN** the calculated binary digest differs from the published SHA-256 digest
- **WHEN** installation validates the download
- **THEN** installation reports an integrity failure
- **AND** removes temporary download data
- **AND** leaves the previous executable unchanged.

#### Scenario: Final replacement fails

- **GIVEN** the download and checksum are valid
- **AND** the destination cannot be replaced, including because a Windows CLI process is still using it
- **WHEN** installation applies the verified binary
- **THEN** installation reports a replacement error
- **AND** restores or retains the previous executable
- **AND** leaves no verified result reported as installed.

#### Scenario: Concurrent installation request

- **GIVEN** an in-app CLI installation is already in progress
- **WHEN** another installation request starts
- **THEN** the system rejects or serializes the duplicate request
- **AND** prevents concurrent writes to the CLI destination.

### Requirement: User-Level Installation Boundary

The in-app CLI installer SHALL write only to the platform's user-level CLI directory and SHALL report PATH guidance without editing shell profiles or system settings.

#### Scenario: Install directory is already on PATH

- **GIVEN** installation succeeds
- **AND** the user-level install directory is on `PATH`
- **WHEN** refreshed status is returned
- **THEN** the status reports PATH visibility.

#### Scenario: Install directory is not on PATH

- **GIVEN** installation succeeds
- **AND** the user-level install directory is not on `PATH`
- **WHEN** Preferences displays the result
- **THEN** it shows the directory the user can add to `PATH`
- **AND** does not modify the user's shell profile.

#### Scenario: Destination is an unexpected file type

- **GIVEN** the CLI destination is a symlink, directory, or another unsupported file type
- **WHEN** installation is attempted
- **THEN** installation stops with an actionable error
- **AND** does not follow or overwrite the unexpected destination.
