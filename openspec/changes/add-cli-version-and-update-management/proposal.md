## Why

`mclip-cli` shares mclip's release version, but the Preferences window currently treats any file at the install path as current. A user with the previously installed `0.1.0` CLI can therefore see an “installed” state even when the binary lacks the current version command, while the in-app install path may still require Cargo and Git and neither installation path verifies a release checksum.

## What Changes

- Detect the installed `mclip-cli` version without reading clipboard history, including a safe `unknown` result for legacy or invalid binaries.
- Compare the installed CLI version with the desktop application's version and expose explicit `notInstalled`, `current`, `outdated`, `newer`, and `unknown` states through the Rust–TypeScript IPC contract.
- Update Preferences to show installed and available versions and present the correct Install, Upgrade, or Reinstall action.
- Make the production in-app action download the matching `mclip-cli` GitHub Release asset for the current OS and CPU architecture without requiring Rust, Cargo, or Git.
- Verify downloaded CLI assets against release-published SHA-256 data before atomically replacing the user-level executable, preserving the existing executable when download or verification fails.
- Make the public install script apply the same release-asset selection and checksum verification rules.
- Enforce release-time version alignment across the desktop application, Cargo package, website package, Git tag, CLI output, and release assets.
- Keep the CLI history format and existing Agent/read/write command behavior unchanged.

## Capabilities

### New Capabilities

- `cli-update-management`: Detect installed CLI versions, classify update state, and install or upgrade the CLI safely from Preferences.

### Modified Capabilities

- `cli-distribution`: Require checksum-verified prebuilt installation and consistent versioning across manifests, tags, binaries, and release assets.

## Impact

- Rust CLI installation/status logic in `src-tauri/src/cli_install.rs`, command registration, and focused Rust integration tests.
- Symmetric IPC fields in `src/types.ts`, `src/services/ipc/commands.ts`, the compatibility facade, and Preferences state/rendering.
- Bilingual Preferences copy and any CLI status styles needed for version and update states.
- GitHub Release asset preparation, checksum assets, version consistency checks, and public `install.sh` copies.
- CLI, installer, Preferences, site-content, and release workflow tests.
- README, AGENTS, bilingual website content, changelog, and `site/public/llms.txt` where installation and upgrade behavior is described.
