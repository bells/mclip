## ADDED Requirements

### Requirement: Linux continuous integration
The project SHALL run frontend, Rust, Node contract, and Linux package checks on an x86_64 Linux runner with explicit Tauri system dependencies.

#### Scenario: Linux pull request gate
- **WHEN** a pull request changes shared or Linux-specific application code
- **THEN** Linux CI installs the documented GTK, WebKitGTK, and tray build prerequisites
- **AND** runs `npm run check`
- **AND** runs `node --test tests/*.test.mjs`.

#### Scenario: Linux CI does not prove native desktop behavior
- **WHEN** the Linux CI job passes without a real X11 or Wayland session smoke
- **THEN** the result is recorded as source/package evidence only
- **AND** no native tray, shortcut, positioning, or clipboard-runtime row is marked complete.

### Requirement: Linux desktop release artifacts
The v0.2.0 Draft Release SHALL contain only Linux x86_64 desktop formats successfully built and installed under the release protocol, with `.deb` and `.AppImage` as the planned minimum.

#### Scenario: Linux bundle upload
- **GIVEN** the Linux release job passes
- **WHEN** Tauri uploads Linux desktop bundles
- **THEN** each advertised x86_64 artifact is non-empty
- **AND** its package version is `0.2.0`.

#### Scenario: Planned format is not reliable
- **GIVEN** a planned Linux package format cannot be installed or smoked reliably
- **WHEN** the Draft asset matrix is finalized
- **THEN** that format is removed from advertised v0.2.0 claims
- **AND** no placeholder asset is uploaded.

### Requirement: Linux CLI release asset
The v0.2.0 Draft Release SHALL include `mclip-cli-linux-x64` and `mclip-cli-linux-x64.sha256` built from the same source version.

#### Scenario: Linux CLI asset verification
- **WHEN** the Linux CLI binary is prepared
- **THEN** `mclip-cli-linux-x64 --version` prints `mclip-cli 0.2.0`
- **AND** its SHA-256 companion verifies the exact uploaded bytes.

#### Scenario: Draft completeness
- **WHEN** all platform upload jobs finish
- **THEN** the same Draft Release contains the Linux CLI binary and checksum plus every advertised desktop artifact
- **AND** the completeness job fails if any required asset is absent.

### Requirement: Linux native support evidence
Linux support claims SHALL be backed by named X11/XWayland and Wayland session evidence for the installed release package.

#### Scenario: Supported Linux session
- **GIVEN** an installed v0.2.0 package on a named supported session
- **WHEN** the release smoke protocol is executed
- **THEN** it records text, image, files, tray, shortcut, preview, positioning, autostart, and CLI results separately
- **AND** records the desktop environment, compositor, display protocol, package format, and architecture.

#### Scenario: Unsupported compositor
- **GIVEN** a pure Wayland compositor lacks a required data-control protocol
- **WHEN** support documentation is generated
- **THEN** that session is listed as unsupported or degraded
- **AND** it is not generalized into a statement that all Wayland sessions are supported.
