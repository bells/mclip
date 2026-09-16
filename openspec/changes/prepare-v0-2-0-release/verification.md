# v0.2.0 Release Preparation Evidence

Reviewed: 2026-09-16

This report separates local source integration, automated checks, native packaged experience, and remote release state. A checked automated row is not native runtime evidence, and source version `0.2.0` is not proof that a public Release exists.

## Prerequisite waiver

Release owner Watson explicitly authorized local v0.2.0 integration to proceed while the four prerequisite changes retain unfinished tasks. The waiver is limited to their blocking effect on local version, migration-test, documentation, and workflow preparation:

- `add-linux-desktop-support`: strict validation passes; 28/34 tasks were complete when waived. Signature-first Linux polling, native Linux session behavior, packaged installation, CLI paste-after-exit ownership, and evidence-backed public support remain unresolved.
- `add-pinned-history-items`: strict validation passes; 29/30 tasks were complete when waived. Packaged macOS pin behavior remains unverified.
- `add-sensitive-content-protection`: strict validation passes; 30/32 tasks were complete when waived. Native macOS/Windows masking and ignored-app behavior plus X11/pure-Wayland evidence remain unverified.
- `add-text-quick-actions-and-pipelines`: strict validation passes; 28/29 tasks were complete when waived. Native macOS desktop and CLI pipeline smoke remains unverified.

Rationale: the owner will perform comprehensive macOS and Windows experience checks separately and does not want those pending tasks to block source version synchronization.

Public limitation: the website and documentation describe `0.2.0` as the current source/release candidate and direct readers to GitHub Releases for publication state. Linux remains an x86_64 preview pending native X11/XWayland and named compositor evidence. macOS remains ad-hoc signed and not notarized; Windows remains unsigned. No pending native row is converted to a pass by this waiver.

Rollback effect: before publication, revert only the release-integration commit while retaining prerequisite feature commits and local user data. After any upgrade, back up `history.json`, `settings.json`, and `history-assets/` before downgrade; v0.1.1 ignores additive v0.2.0 fields but does not understand pin protection and may trim pinned entries as ordinary history.

The waiver does not authorize creation or push of `v0.2.0`, Draft publication, remote asset replacement, or claims of native success.

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

## Draft asset contract

The release workflow expects macOS ARM64, Windows x64, and Linux x64 `mclip-cli` binaries with matching `.sha256` companions. After the publish matrix completes, matching-OS verification jobs download each binary from the same Draft, verify SHA-256, and execute `mclip-cli --version`. The Linux job also requires non-empty `.deb` and AppImage assets.

This contract has not been executed against a v0.2.0 Draft in this change. Missing assets, checksum failures, or version mismatches block publication.

## Automated results

- `pnpm run check`: pass; frontend production build succeeded, Rust reported 230 passed and 3 ignored, followed by `cargo check` and clippy with warnings denied.
- `node --test tests/*.test.mjs`: pass, 224/224.
- `pnpm run cli:test`: pass, 21/21; the full Rust gate also passed 9/9 CLI installer integration tests.
- `mclip-cli --version`, `-V`, and `version`: all returned `mclip-cli 0.2.0` against a missing history path.
- `pnpm run site:test`: pass, 16/16.
- `pnpm run site:build`: pass, six localized pages generated.
- `cmp -s install.sh site/public/install.sh`: pass.
- `XWIN_ARCH=x86_64 cargo xwin check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets`: pass; source compatibility only.
- `openspec validate --all --strict --no-interactive`: pass, 26/26 items.
- `git diff --check`: pass.

The worktree audit found only the intended v0.2.0 integration, migration-test, documentation, workflow, and OpenSpec paths. No commit was requested or created.

## Remote state

- Local release commit: not created; no commit was requested in this apply operation.
- `v0.2.0` tag: not created or pushed.
- Draft Release: not created or inspected.
- Remote assets: not uploaded, replaced, or downloaded.
- Publication: not authorized and not performed.

## Remaining owner actions

1. Run and record the comprehensive native macOS and Windows packaged experience checks.
2. Decide whether and when Linux X11/XWayland and named compositor checks are required for publication.
3. Request a scoped local commit when the source candidate is accepted.
4. Explicitly authorize tag push, then inspect and verify the same Draft before separately authorizing publication.
