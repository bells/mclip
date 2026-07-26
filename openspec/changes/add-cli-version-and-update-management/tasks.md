## 1. Release Contract and Test Foundations

- [x] 1.1 Add focused Rust fixtures and tests for semantic version parsing, all five CLI update states, malformed legacy output, non-zero exits, and a probe process that must be timed out and reaped.
- [x] 1.2 Add narrowly featured `semver` and native HTTPS client dependencies, update `Cargo.lock`, and keep SHA-256 calculation on the existing `sha2` dependency.
- [x] 1.3 Extract and test the supported OS/architecture asset-name table, exact-version Release URLs, companion checksum naming, checksum parsing, response size limits, and unsupported-platform errors.
- [x] 1.4 Add destination-directory fixtures that can verify successful replacement, checksum failure, symlink rejection, permission handling, rollback, and cleanup without touching the real user CLI path.

## 2. Version-Aware Rust Status

- [x] 2.1 Replace the existence/source-availability status model with a serializable `CliInstallState` and status fields for installed version, running desktop target version, platform install support, install path, and PATH visibility.
- [x] 2.2 Implement a fixed-path, shell-free `mclip-cli --version` probe with bounded output, a short timeout, child termination/reaping, exact output parsing, and no history-file access.
- [x] 2.3 Classify missing, current, outdated, newer, and legacy/invalid binaries against Tauri package metadata, including focused tests for each comparison and for a `0.1.0`-to-newer target.
- [x] 2.4 Run version probing off the UI thread and keep `get_cli_install_status` responsive when the installed binary hangs or fails.

## 3. Native Release Download and Recoverable Installation

- [x] 3.1 Implement an injectable async Release client that downloads the exact desktop-version binary and checksum over HTTPS with status validation, bounded redirects, request timeouts, and download size limits.
- [x] 3.2 Verify the downloaded binary against the release checksum before setting executable permissions or changing the destination, and return distinct errors for unpublished assets, missing checksum data, malformed checksum data, and digest mismatch.
- [x] 3.3 Implement destination-local temporary downloads and recoverable replacement with unexpected-file-type checks, Unix executable permissions, Windows-compatible backup/restore, and cleanup after success or failure.
- [x] 3.4 Add a process-local installation guard and cover concurrent requests plus Windows-style in-use replacement failures without losing the previous executable.
- [x] 3.5 Convert `install_cli` to an async Tauri command that targets the running app version, removes the production Cargo/Git requirement, refreshes status after installation, and reports success only when the installed state is `current`.
- [x] 3.6 Extend Rust integration tests with an injected local Release transport for successful install, legacy upgrade, network failure, checksum failure, rollback, unsupported platform, and post-install version verification.

## 4. Typed Preferences Experience

- [x] 4.1 Mirror the Rust state and nullable version fields in `src/types.ts`, update typed command wrappers and the compatibility facade, and remove frontend reliance on `sourceAvailable`.
- [x] 4.2 Update the Preferences CLI tab to display installed and target versions and map `notInstalled`, `outdated`, `unknown`, `current`, and `newer` to Install, Upgrade, Upgrade, Reinstall, and no implicit downgrade respectively.
- [x] 4.3 Add Chinese and English copy for legacy detection, unsupported platform, unpublished Release, network failure, checksum mismatch, replacement failure, successful upgrade, and PATH guidance.
- [x] 4.4 Add frontend behavior tests for every status/action mapping, disabled/in-progress behavior, refreshed success state, retryable errors, and preservation of the displayed installed version after failure.

## 5. Public Installer and Release Workflow

- [x] 5.1 Update `install.sh` to download the binary and companion checksum from the same latest or `MCLIP_VERSION`-pinned Release, verify SHA-256 before replacement, fail closed on integrity errors, and preserve the previous executable.
- [x] 5.2 Keep `site/public/install.sh` byte-for-byte identical and add installer fixture tests for latest/pinned URL selection, supported asset mapping, valid checksum, missing/malformed/mismatched checksum, source fallback, PATH guidance, and existing-binary preservation.
- [x] 5.3 Extend the Release workflow to fail before upload unless the Git tag, root and website packages, lockfiles, Cargo package, and built `mclip-cli --version` all match.
- [x] 5.4 Generate one `.sha256` companion for every CLI binary, upload both assets to the same draft Release, and test that installer mappings advertise only assets the workflow produces.
- [x] 5.5 Keep the existing remote `v0.1.1` tag and draft assets unchanged during implementation; before any release operation, explicitly choose between publishing that existing CLI upgrade and shipping this management feature in the next version, or separately authorizing a tag/draft rebuild.

## 6. Documentation Alignment

- [x] 6.1 Update both README language sections and `AGENTS.md` with shared CLI/desktop version semantics, version-aware Preferences states, verified Release installation, user-level destinations, and the no-automatic-downgrade rule.
- [x] 6.2 Update the bilingual website pages and changelog plus `site/public/llms.txt` so public install, upgrade, checksum, supported-platform, and safety statements match the final behavior.
- [x] 6.3 Update site content tests and any release/installer documentation assertions together with the public copy.

## 7. Verification

- [x] 7.1 Run focused CLI status/install Rust tests, CLI binary integration tests, installer script fixtures, and Preferences behavior tests.
- [x] 7.2 Run `npm run check` and resolve all TypeScript, Rust formatting, unit/integration test, compile, and clippy failures.
- [ ] 7.3 Run `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc` and rely on GitHub Actions `windows-2022` for the native Windows install/replacement path.
  - Local attempt reaches `ring`'s C build and stops because this macOS host has no MSVC/Windows SDK sysroot (`assert.h` is unavailable); `windows-2022` remains the authoritative check.
- [x] 7.4 Run `npm run site:test`, `npm run site:build`, an exact comparison of both installer copies, and `git diff --check`.
- [ ] 7.5 Smoke-test the macOS Preferences CLI tab with missing, legacy/unknown, outdated, current, and newer fixture binaries, including failed checksum and unavailable-Release paths without touching production history data.
  - The fully isolated debug app and local fixture paths start successfully, and the production `history.json` hash/mtime remain unchanged, but Computer Use cannot discover the unpackaged `target/debug/mclip` process, so the five-state GUI interaction pass is still pending.
- [ ] 7.6 For the eventual containing release, verify authenticated draft CLI/checksum downloads and digest validation on macOS and Windows before publication; record that draft verification does not constitute public-installer availability until the Release is published.
  - Deferred to the eventual containing Release; the existing remote `v0.1.1` tag and draft assets were not moved, rebuilt, or published by this change.
