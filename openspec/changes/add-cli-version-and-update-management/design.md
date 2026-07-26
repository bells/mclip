## Context

`mclip-cli` is a second Rust binary in the same Cargo package as the Tauri desktop application. The current CLI reports `CARGO_PKG_VERSION`, while Tauri reads the desktop version from the root `package.json`; release preparation currently keeps those values aligned manually. The installed CLI at the user-level path can predate version support, but `CliInstallStatus` only reports file existence, PATH visibility, and whether a local/source build appears possible.

The public shell installer already prefers GitHub Release binaries, whereas the Tauri `install_cli` command searches for a local binary or manifest and otherwise clones `main` and builds with Cargo. This creates two different installation contracts and leaves ordinary desktop users without a reliable in-app path when developer tools are absent. Neither path currently verifies release-provided integrity data before replacing the installed executable.

The change crosses Rust networking and filesystem code, a camelCase Rust–TypeScript IPC contract, Preferences UI and translations, public shell installation, and the GitHub Release workflow. The implementation must remain user-level, avoid administrator directories, preserve a working older CLI on failure, and keep CLI help/version independent of history-file access.

## Goals / Non-Goals

**Goals:**

- Reliably distinguish missing, current, outdated, newer, and unrecognized installed CLI binaries.
- Upgrade the user's legacy or `0.1.0` CLI to the exact CLI version paired with the running desktop application.
- Let production users install or upgrade from Preferences without Cargo, Git, or a shell.
- Verify a release-published SHA-256 value before making a downloaded binary executable or replacing the installed CLI.
- Give the public installer and in-app installer the same asset naming, version selection, integrity, and user-level destination rules.
- Make release version drift fail before artifacts are published.
- Keep status and installation logic independently testable without real GitHub downloads or writes to the real user install directory.

**Non-Goals:**

- Adding `mclip-cli update` or self-update commands in this change.
- Updating the Tauri desktop application itself.
- Changing CLI history commands, the Agent JSON schema, or the persisted history/settings formats.
- Adding cloud services, telemetry, privileged installation, or system-wide PATH modification.
- Expanding desktop platform support beyond the OS/architecture combinations for which the Release workflow publishes CLI assets.

## Decisions

### 1. The running desktop version is the in-app target version

The Rust command will obtain the target version from Tauri's running package metadata and compare it with the installed CLI using the mature `semver` crate. The status contract will expose:

- `state`: `notInstalled`, `current`, `outdated`, `newer`, or `unknown`;
- `installedVersion`: a semantic version string or `null`;
- `targetVersion`: the running desktop version;
- the user-level install directory/path and PATH visibility;
- whether the current platform has a known Release asset.

The in-app installer will resolve the exact tag `v<targetVersion>`, rather than downloading GitHub's latest release. This prevents an older desktop application from silently installing a newer, potentially incompatible CLI. The standalone public installer may continue to select the latest published release by default and use `MCLIP_VERSION` when the caller requests a pinned version.

The Release workflow will guarantee that the root package, Cargo package, website package, lockfiles, Git tag, and built CLI output all describe the same version. Sharing one product release version remains simpler than introducing an independent CLI release lifecycle.

An alternative was to query the latest release during every status check. That would make Preferences status network-dependent and could recommend a CLI version newer than the running app, so it is not used.

### 2. Installed version probing is bounded and history-independent

Status detection will execute the configured installed path directly with `--version`, capture stdout/stderr, and accept only the expected `mclip-cli <semver>` output with a successful exit status. The probe will have a short timeout, kill and reap a stuck child, and run off the UI thread. It will never invoke the CLI through a shell or resolve a different executable through `PATH`.

Classification rules are:

- no regular file: `notInstalled`;
- valid version lower than target: `outdated`;
- valid version equal to target: `current`;
- valid version higher than target: `newer`;
- timeout, non-zero exit, malformed output, or a legacy binary without version support: `unknown`.

`unknown` is intentionally recoverable: Preferences will explain that the installed version cannot be identified and offer Upgrade. A newer CLI will be reported but will not be automatically downgraded.

An alternative was to inspect binary metadata or timestamps. Those values are not portable and cannot prove the product version, so the existing history-independent version command is the contract.

### 3. Production installation uses a native Release downloader

`install_cli` will become an asynchronous Tauri command backed by a small Rust service with injectable release transport and install-directory inputs. It will map the current OS and CPU architecture to the same asset name used by `install.sh`, then download:

- `mclip-cli-<platform>-<arch>[.exe]`;
- the companion `mclip-cli-<platform>-<arch>[.exe].sha256`.

The implementation will use the actively maintained `reqwest` client with a Rustls TLS backend instead of launching `curl`; it will reuse the existing `sha2` dependency for digest calculation. Requests will use HTTPS, bounded redirects, response-status validation, size limits, and request timeouts. Unsupported platforms and unpublished/missing assets will return actionable errors.

Development and tests may inject a local source or fixture transport, but the production Preferences path will not clone `main` or compile source. The UI's install availability will be based on Release platform support rather than the presence of Cargo and Git.

Bundling the CLI as a Tauri resource was considered. It would help the first install but would duplicate per-architecture packaging logic and would not solve standalone installer integrity or later CLI replacement. `tauri-plugin-updater` was also considered, but it manages the desktop application bundle rather than an independently installed user-level executable.

### 4. Verification precedes an atomic, recoverable replacement

The release workflow will publish one SHA-256 companion file per CLI asset. Both installers will parse the expected hexadecimal digest, calculate the downloaded binary digest, and fail closed on a missing, malformed, or mismatched checksum.

The Rust installer will download into a uniquely named temporary file inside the destination directory so the final rename stays on the same filesystem. It will:

1. reject an unexpected destination file type or symlink;
2. verify the complete download and checksum;
3. apply executable permissions on Unix;
4. move an existing executable to a temporary backup when the platform cannot replace it atomically;
5. rename the verified file to the final path;
6. restore the backup if the final replacement fails;
7. remove temporary files and the backup only after success.

A process-local guard will reject or serialize concurrent in-app installations. On Windows, a running CLI may prevent replacement; that error will leave the previous executable intact and tell the user to stop the CLI before retrying.

The shell installer will also verify before `cp`/replacement and will never fall back to installing an unverified downloaded binary. Source-build fallback may remain for a genuinely missing supported prebuilt asset when Cargo and Git are available, because that path builds checked-out source rather than accepting an unchecked binary.

### 5. Preferences renders behavior from the typed state

The Rust enum and fields will be mirrored explicitly in `src/types.ts`; typed wrappers remain in `src/services/ipc/commands.ts` and the existing facade. Preferences will show target and installed versions and map states to actions:

- `notInstalled` → Install;
- `outdated` → Upgrade;
- `unknown` → Upgrade with legacy/unrecognized explanation;
- `current` → Reinstall;
- `newer` → report the newer installed version without an implicit downgrade.

After a successful install, Preferences will refresh status by probing the installed executable and only report success when it returns the target version. Download, checksum, permission, or replacement failures will remain visible and retryable without changing the displayed installed version.

Chinese and English messages will distinguish version detection failure, unsupported platform, unavailable draft/unpublished Release, checksum mismatch, and replacement failure.

### 6. Both installers share a release artifact contract

Rust and `install.sh` cannot directly share implementation code, so the shared contract will be made explicit and covered by tests:

- identical platform/architecture-to-asset mapping;
- exact/pinned version URL construction;
- companion checksum naming and format;
- user-level destination defaults;
- fail-closed checksum behavior;
- PATH guidance without editing shell profiles.

`site/public/install.sh` will remain byte-for-byte identical to the root script. Documentation and content tests will be updated together because the public installer and Agent-facing `llms.txt` are part of the CLI interface.

### 7. Release validation occurs before upload

Before building or uploading, the Release workflow will compare the tag with the root and website package versions and the Cargo package version, verify relevant lockfile versions, and run the newly built CLI with `--version`. Each CLI build will generate its companion checksum file, and both files will be uploaded to the same draft Release.

The asset matrix and installer mapping will be tested so the installers never advertise a platform/architecture name that the workflow cannot produce. Draft Releases remain intentionally unavailable to unauthenticated production installers; the error will identify that the version's assets are not published yet.

## Risks / Trade-offs

- [Risk] Running an unexpected executable to detect its version could hang or produce arbitrary output. → Execute the fixed user-level path without a shell, enforce a short timeout, bound captured output, validate the exact format, and classify failures as `unknown`.
- [Risk] Network or draft-Release failures could leave a partial executable. → Download to a destination-local temporary path and never replace the installed binary before status, size, and SHA-256 validation succeed.
- [Risk] Windows may refuse to replace a currently running CLI. → Preserve the old binary, restore it on rename failure, and return a specific retry message.
- [Risk] Rust and shell asset mapping may drift. → Centralize each implementation's mapping, add the same fixture table to focused tests, and validate the Release asset matrix.
- [Risk] Adding `reqwest` and `semver` increases dependency and binary size. → Use focused features with Rustls, reuse the existing SHA-256 dependency, and accept the modest size cost in exchange for native cross-platform TLS and correct version ordering.
- [Trade-off] The in-app installer targets the desktop application's version rather than always installing the latest CLI. This favors compatibility and deterministic recovery; standalone users retain the latest-release installer path.
- [Trade-off] A companion checksum protects against transport corruption and accidental asset mismatch but does not provide independent publisher authentication beyond GitHub HTTPS and repository control. Signed release manifests can be added later if the threat model changes.

## Migration Plan

1. Add release-version validation and checksum asset generation without changing existing installation behavior.
2. Add the version probe, semantic status model, native downloader, and atomic installer behind focused unit/integration tests.
3. Update the typed IPC contract and Preferences UI, treating existing non-version-aware binaries as `unknown` and upgradeable.
4. Update both shell installer copies to enforce the same checksum contract.
5. Update public documentation and run CLI, Rust, frontend, site, release-script, and diff validation.
6. Verify checksum assets and authenticated draft downloads on macOS and Windows for the release that contains this implementation, then publish it so production installers can resolve the matching version.

Rollback can restore the prior UI and installer command while leaving any successfully installed CLI in place. No history or settings migration is involved. If a new installer fails in production, users can retain their existing CLI and use a previously published installer or manually select a trusted Release asset.

## Open Questions

The remote `v0.1.1` tag and draft assets already point to a commit that predates this change. The safe default is to publish that existing Release so standalone users can upgrade the old CLI to `0.1.1`, then ship this in-app version management in the next product version. Rebuilding the unpublished `v0.1.1` Release around the later implementation would require explicit authorization to move the remote tag and replace draft assets; implementation and normal verification MUST NOT do that implicitly.

All other decisions are settled: the running desktop version is the in-app target, per-asset SHA-256 companion files are the integrity contract, and a newer installed CLI is not automatically downgraded.
