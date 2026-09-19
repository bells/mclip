# v0.2.0 Release Preparation Evidence

Reviewed: 2026-09-19

This report separates local source integration, automated checks, native packaged experience, and remote release state. Public `v0.2.0` now exists, but publication and passing CI are still not native runtime evidence for every packaged scenario.

## Prerequisite waiver

Release owner Watson explicitly authorized local v0.2.0 integration to proceed while the four prerequisite changes retain unfinished tasks. The waiver is limited to their blocking effect on local version, migration-test, documentation, and workflow preparation:

- `add-linux-desktop-support`: strict validation passes; 28/34 tasks were complete when waived. Signature-first Linux polling, native Linux session behavior, packaged installation, CLI paste-after-exit ownership, and evidence-backed public support remain unresolved.
- `add-pinned-history-items`: strict validation passes; 29/30 tasks were complete when waived. Packaged macOS pin behavior remains unverified.
- `add-sensitive-content-protection`: strict validation passes; 30/32 tasks were complete when waived. Native macOS/Windows masking and ignored-app behavior plus X11/pure-Wayland evidence remain unverified.
- `add-text-quick-actions-and-pipelines`: strict validation passes; 28/29 tasks were complete when waived. Native macOS desktop and CLI pipeline smoke remains unverified.

Rationale: the owner will perform comprehensive macOS and Windows experience checks separately and does not want those pending tasks to block source version synchronization.

Public limitation: the website and documentation describe `v0.2.0` as the current public release. Linux remains an x86_64 preview pending native X11/XWayland and named compositor evidence. macOS remains ad-hoc signed and not notarized; Windows remains unsigned. No pending native row is converted to a pass by publication.

Rollback effect: after publication or any upgrade, back up `history.json`, `settings.json`, and `history-assets/` before downgrade; v0.1.1 ignores additive v0.2.0 fields but does not understand pin protection and may trim pinned entries as ordinary history. A source-only revert does not remove the already published Release.

The waiver itself did not authorize creation or push of `v0.2.0`, Draft publication, remote asset replacement, or claims of native success. Those remote release actions were later performed separately by the release owner; the remaining native limits are unchanged.

## Migration and version evidence

| Area | Evidence | Result |
| --- | --- | --- |
| v0.1.1 history | Synthetic text/image/files fixture covers IDs, timestamps, copy counts, source apps, legacy field aliases, file paths, and a referenced image asset; read-only load preserves source bytes and asset bytes | Pass locally |
| v0.1.1 settings | Synthetic fixture covers every v0.1.1 field and boundary values; v0.2.0 applies safe defaults for pins, privacy, ignored apps, and text actions without rewriting the file | Pass locally |
| Sensitive output | Rust/CLI and frontend tests verify default masking while explicit reveal/copy retains the original synthetic value | Pass locally |
| Downgrade | A v0.1.1-shaped reader ignores additive pin fields; README documents backup/restore and the old trim risk | Pass locally with documented limitation |
| Version mirrors | Root/site manifests, Cargo manifest/lock, frontend fallback, Tauri package reference, website schema, and CLI output are enumerated by tests/workflow | Pass locally |

## Verification matrix

| Platform/session | Source/unit checks | Package install | Clipboard, tray, windows, autostart, pins, privacy, quick actions, CLI | Status |
| --- | --- | --- | --- | --- |
| macOS (current host) | `pnpm run check`, root Node, CLI/installer, migration, and site gates pass | Pending owner check | Pending owner check | Automated pass; pending native evidence |
| Windows x64 | cargo-xwin all-target check passes; CI/workflow configured | Pending owner check | Pending owner check, including WebView2, DPI, file-list paste, installer, SmartScreen | Source pass; pending native evidence |
| Linux x86_64 X11/XWayland | CI/release configuration only | Not run | Not run | Preview; pending native evidence |
| Linux pure Wayland | CI/release configuration only | Not run | Source-app exclusion unavailable; other capabilities compositor-specific | Unsupported/unavailable cells remain explicit |

## Release asset contract

The release workflow expects macOS ARM64, Windows x64, and Linux x64 `mclip-cli` binaries with matching `.sha256` companions. After the publish matrix completes, matching-OS verification jobs download each binary from the same Draft, verify SHA-256, and execute `mclip-cli --version`. The Linux job also requires non-empty `.deb` and AppImage assets.

This contract executed successfully in release workflow run [35414182138](https://github.com/bells/mclip/actions/runs/35414182138) at commit `fb4e0f30af5da367663ddbda5b462ecf6b70cc5c`. Matching macOS, Windows, and Linux jobs downloaded each CLI and checksum from the same Release, verified SHA-256, and executed `--version`; the Linux job also required the `.deb` and AppImage assets. The public Release contains 12 assets.

## Automated results

- Three-platform CI run [35414091753](https://github.com/bells/mclip/actions/runs/35414091753): pass at `fb4e0f30af5da367663ddbda5b462ecf6b70cc5c`; macOS, Windows, and Linux ran project checks and root contract tests, and Linux also built `.deb`/AppImage packages.
- Release workflow run [35414182138](https://github.com/bells/mclip/actions/runs/35414182138): pass at the same commit; all publish and same-Release verification jobs completed successfully.

- `pnpm run check`: pass; frontend production build succeeded, Rust reported 231 passed and 3 ignored, followed by `cargo check` and clippy with warnings denied.
- `node --test tests/*.test.mjs`: pass, 227/227.
- `pnpm run cli:test`: pass, 21/21; the full Rust gate also passed 9/9 CLI installer integration tests.
- `mclip-cli --version`, `-V`, and `version`: all returned `mclip-cli 0.2.0` against a missing history path.
- `pnpm run site:test`: pass, 16/16.
- `pnpm run site:build`: pass, six localized pages generated.
- `cmp -s install.sh site/public/install.sh`: pass.
- `XWIN_ARCH=x86_64 cargo xwin check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets`: pass; source compatibility only.
- `openspec validate --all --strict --no-interactive`: pass, 26/26 items.
- `git diff --check`: pass.

The earlier worktree audit found only the intended v0.2.0 integration, migration-test, documentation, workflow, and OpenSpec paths. The final published tag includes later Windows-experience and keyboard-navigation fixes through `fb4e0f3`.

## Remote state

- Release commit/tag: `v0.2.0` resolves locally and remotely to `fb4e0f30af5da367663ddbda5b462ecf6b70cc5c`.
- Release: [`mclip v0.2.0`](https://github.com/bells/mclip/releases/tag/v0.2.0), published at `2026-09-19T02:58:14Z`; not a Draft and not a prerelease.
- Assets: 12 published files covering macOS ARM64 desktop/CLI, Windows x64 desktop/CLI, Linux x86_64 desktop/CLI, and all three CLI checksum companions.
- Latest: GitHub's latest-release endpoint resolves to `v0.2.0` as of this review.
- Remaining remote mutation boundary: moving the tag or replacing assets still requires explicit release-owner action and a fresh completeness check.

## Remaining owner actions

1. Run and record the comprehensive native macOS and Windows packaged experience checks.
2. Run and record Linux X11/XWayland and named compositor checks while keeping Linux labeled preview until the claimed matrix is supported.
3. Run the public installer against v0.2.0 on each supported CLI platform and record atomic replacement/rollback behavior.
4. Preserve the current release tag and assets unless a separately authorized recovery or replacement is required.
