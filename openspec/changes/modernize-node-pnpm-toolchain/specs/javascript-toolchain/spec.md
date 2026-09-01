## ADDED Requirements

### Requirement: Supported Node.js runtime is explicit
The repository SHALL define Node.js 24 as the supported runtime major for the root application, the website, local version-manager discovery, continuous integration, release builds, and hosted website builds. The declared range SHALL reject Node.js majors below 24 and SHALL require an explicit repository change before accepting a later major.

#### Scenario: Developer selects the repository runtime
- **WHEN** a developer enters the repository with a version manager that reads the committed runtime file
- **THEN** the selected Node.js major is 24

#### Scenario: Package metadata is evaluated
- **WHEN** tooling evaluates either the root or website package manifest
- **THEN** it finds a Node.js engine range that accepts Node.js 24 and rejects Node.js 20, Node.js 22, and Node.js 25 or later

#### Scenario: Automated build selects Node.js
- **WHEN** CI, release, or the hosted website build initializes its JavaScript runtime
- **THEN** it uses Node.js 24 rather than a platform default

### Requirement: pnpm is the single pinned package manager
The repository SHALL declare pnpm 10.33.0 as its exact supported package-manager version and SHALL use that version for local, CI, release, and hosted website dependency operations. Active build configuration and canonical developer instructions SHALL NOT present npm as a supported alternative.

#### Scenario: Developer bootstraps package management
- **WHEN** a developer on Node.js 24 enables the repository package manager through Corepack
- **THEN** pnpm 10.33.0 is selected from committed package metadata

#### Scenario: Automation installs pnpm
- **WHEN** CI or release automation prepares the JavaScript toolchain
- **THEN** it installs or activates the pinned pnpm version before enabling pnpm caching or installing dependencies

#### Scenario: Unsupported npm workflow is attempted
- **WHEN** a contributor follows the canonical README, AGENTS, OpenSpec project guidance, Tauri hooks, or workflow configuration
- **THEN** every package-manager command uses pnpm and no active instruction requires `npm ci` or `npm run`

### Requirement: Application and website share a frozen workspace lock
The repository SHALL model the root application and `site/` as pnpm workspace importers in one committed root `pnpm-lock.yaml`. It SHALL NOT retain root or website npm lockfiles, and automation SHALL install with frozen-lockfile enforcement.

#### Scenario: Clean workspace install succeeds
- **WHEN** the two package manifests match the committed workspace lockfile
- **THEN** `pnpm install --frozen-lockfile` installs both the root application and website dependency graphs without modifying the lockfile

#### Scenario: A manifest drifts from the lockfile
- **WHEN** either importer manifest changes without regenerating `pnpm-lock.yaml`
- **THEN** the frozen install fails before build or release work begins

#### Scenario: Lockfile topology is inspected
- **WHEN** the committed dependency metadata is inspected
- **THEN** exactly one pnpm lockfile governs both `.` and `site` importers and neither `package-lock.json` exists

### Requirement: Build entry points remain behaviorally equivalent
The pnpm migration SHALL preserve the existing root script names and SHALL keep application development, production build, Tauri development/build, CLI, root tests, and website development/test/build commands executable through pnpm. Tauri and hosted website configuration SHALL invoke the pnpm-backed entry points.

#### Scenario: Existing root task is run through pnpm
- **WHEN** a contributor runs a documented root task such as `pnpm run check`, `pnpm run tauri:dev`, `pnpm run cli:test`, or `pnpm run site:build`
- **THEN** it executes the same underlying application, Rust, CLI, or website operation as before the package-manager migration

#### Scenario: Tauri invokes frontend lifecycle hooks
- **WHEN** Tauri starts development mode or creates a production bundle
- **THEN** its configured pre-command runs the corresponding pnpm root script

#### Scenario: Hosted website builds from the site root
- **WHEN** Vercel installs and builds the `site/` project
- **THEN** it uses Node.js 24, the pinned pnpm version, the workspace lockfile, and the website build script

### Requirement: Release checks use authoritative version sources
Release automation SHALL compare the release tag with the root package manifest, website package manifest, Cargo manifest, and Cargo lock package version. It SHALL rely on a successful frozen pnpm workspace install for JavaScript dependency-lock consistency and SHALL NOT require npm-specific lockfile version fields.

#### Scenario: Product versions agree
- **WHEN** the tag and all authoritative package/Cargo version sources match and the frozen pnpm install has succeeded
- **THEN** release validation proceeds to build artifacts

#### Scenario: Product version differs
- **WHEN** any authoritative manifest or Cargo lock version differs from the release tag
- **THEN** release validation fails and identifies the mismatched source

#### Scenario: Workspace lock is stale
- **WHEN** either JavaScript importer differs from the committed pnpm lockfile
- **THEN** the frozen install fails before release version validation or artifact creation

### Requirement: Toolchain drift is regression tested
The repository SHALL include automated source-contract coverage for the Node.js major, exact pnpm pin, workspace importers, lockfile policy, Tauri hooks, CI/release commands, and canonical active documentation.

#### Scenario: Toolchain configuration is consistent
- **WHEN** the root Node contract test suite runs against a correctly migrated repository
- **THEN** the JavaScript toolchain contract tests pass

#### Scenario: An active npm command or unsupported runtime returns
- **WHEN** a guarded manifest, workflow, Tauri hook, or canonical documentation surface drifts back to npm or an unsupported Node.js major
- **THEN** the toolchain contract test fails with the affected surface identifiable
