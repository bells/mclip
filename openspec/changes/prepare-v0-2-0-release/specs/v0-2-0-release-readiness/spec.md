## ADDED Requirements

### Requirement: Prerequisite change gate
The v0.2.0 release integration SHALL NOT begin version finalization until the four named feature changes are strictly valid and their required implementation tasks are complete or explicitly waived by the release owner.

#### Scenario: Prerequisite incomplete
- **GIVEN** any of `add-linux-desktop-support`, `add-pinned-history-items`, `add-sensitive-content-protection`, or `add-text-quick-actions-and-pipelines` has an incomplete required task
- **WHEN** release readiness is evaluated
- **THEN** v0.2.0 is not declared feature-complete
- **AND** the unresolved task and verification boundary are listed.

#### Scenario: Prerequisites pass
- **WHEN** all four prerequisite changes pass strict validation and required tasks
- **THEN** version synchronization and final packaged verification may proceed.

### Requirement: Synchronized v0.2.0 version truth
The release source SHALL use root `package.json` version `0.2.0` as truth and SHALL synchronize every version-bearing manifest, lockfile, binary, website, changelog, and Release surface.

#### Scenario: Version gate passes
- **GIVEN** a `v0.2.0` release candidate
- **WHEN** the version gate runs
- **THEN** root/site package manifests, Cargo manifest and lockfile, the frontend fallback, Tauri-resolved version, and `mclip-cli --version` all resolve to `0.2.0`
- **AND** dependency resolution remains consistent with the shared root `pnpm-lock.yaml`, without requiring an app-version field or creating npm/site-only locks.

#### Scenario: One version source differs
- **WHEN** any enumerated version source differs from `0.2.0`
- **THEN** the release workflow fails before uploading assets.

### Requirement: v0.1.1 data migration evidence
v0.2.0 SHALL load representative v0.1.1 history and settings without losing existing entry data, and SHALL apply safe defaults for new fields.

#### Scenario: Legacy fixture load
- **GIVEN** a v0.1.1 fixture containing text, image, and files entries plus settings
- **WHEN** v0.2.0 loads the fixture
- **THEN** IDs, timestamps, copy counts, content, paths, and image references are preserved
- **AND** new pin/privacy settings receive specified defaults
- **AND** loading alone does not rewrite the fixture.

#### Scenario: Safe default serialization
- **GIVEN** a legacy text entry is classified as sensitive by an explicit reclassification action after loading
- **WHEN** default desktop or CLI presentation is produced
- **THEN** the visible/output value is masked
- **AND** the stored original remains locally available for explicit copy/reveal.

### Requirement: Platform-specific release verification
The release evidence SHALL distinguish automated source checks, package installation, and native runtime smoke for macOS, Windows, Linux X11/XWayland, and each named supported Wayland session.

#### Scenario: Cross-target check only
- **WHEN** a target compiles or passes CI without native runtime interaction
- **THEN** only its automated evidence is marked complete
- **AND** tray, shortcut, clipboard, window, autostart, and ignored-app runtime rows remain pending.

#### Scenario: Native session smoke
- **WHEN** an installed release package is tested on a named native session
- **THEN** evidence records text/image/files clipboard round trips, tray/shortcut, multi-monitor positioning, previews, pins, privacy, quick actions, CLI pipelines, and autostart independently.

### Requirement: Same-Draft asset completeness
The same v0.2.0 Draft Release SHALL contain every advertised desktop package and CLI binary plus required checksum companions, and every binary SHALL report the release version.

#### Scenario: Complete Draft
- **WHEN** all platform publish jobs finish
- **THEN** the completeness job downloads the expected macOS ARM64, Windows x64, and Linux x64 asset set from the same Draft
- **AND** verifies every CLI checksum
- **AND** verifies every CLI binary reports `0.2.0`.

#### Scenario: Missing or mismatched asset
- **WHEN** an advertised asset, checksum, or version is missing or mismatched
- **THEN** the completeness gate fails
- **AND** the Draft is not declared publishable.

### Requirement: Evidence-backed public claims
README, PRODUCT, AGENTS, Chinese/English/Japanese site/changelog, `llms.txt`, installer guidance, and Release copy SHALL describe only capabilities and packages supported by current evidence.

#### Scenario: Unsupported Linux target
- **GIVEN** Linux ARM64, AUR, or a Wayland compositor has no required release evidence
- **WHEN** public support text is updated
- **THEN** it is listed as unavailable, deferred, experimental, or omitted
- **AND** is not advertised as supported.

#### Scenario: Signing limitations
- **WHEN** v0.2.0 remains ad-hoc signed on macOS or unsigned on Windows
- **THEN** Release and installation guidance retains the corresponding Gatekeeper and SmartScreen limitations.

### Requirement: Release-owner authority
Tag creation/replacement/push, Draft publication, and remote asset replacement SHALL require explicit release-owner authorization and SHALL be reported separately from local verification.

#### Scenario: Local release preparation completes
- **WHEN** source, checks, and local commit are ready but no remote authorization was given
- **THEN** no tag is pushed and no Draft is published
- **AND** the handoff reports the exact local commit and pending owner actions.

#### Scenario: Owner authorizes publication action
- **WHEN** the release owner explicitly authorizes a named remote action
- **THEN** only that action and its required safe verification are performed
- **AND** unrelated branches, tags, or assets are not mutated.
