## 1. Prerequisite Gate

- [ ] 1.1 Confirm `add-linux-desktop-support` passes strict validation and has no unresolved required implementation or Linux evidence tasks.
- [ ] 1.2 Confirm `add-pinned-history-items` passes strict validation and has no unresolved required implementation or migration tasks.
- [ ] 1.3 Confirm `add-sensitive-content-protection` passes strict validation and has no unresolved required implementation or privacy tasks.
- [ ] 1.4 Confirm `add-text-quick-actions-and-pipelines` passes strict validation and has no unresolved required implementation or CLI tasks.
- [x] 1.5 Record any release-owner waiver with exact scope, rationale, public limitation, and rollback effect before proceeding.

## 2. Migration and Downgrade Evidence

- [x] 2.1 Add synthetic v0.1.1 history fixtures covering text, image, files, legacy aliases, timestamps, copy counts, source app, and referenced image assets.
- [x] 2.2 Add v0.1.1 settings fixtures covering every existing field and boundary value.
- [x] 2.3 Verify v0.2.0 read-only load preserves legacy data, applies pin/privacy defaults, and does not rewrite files.
- [x] 2.4 Verify default desktop/CLI serialization masks reclassified secrets while explicit copy/reveal preserves originals.
- [x] 2.5 Test v0.1.1 reader tolerance for v0.2.0 optional fields or publish an explicit backup/transform downgrade procedure.

## 3. Version and Product Truth Synchronization

- [x] 3.1 After the prerequisite gate passes, set root `package.json` to `0.2.0` and synchronize `site/package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and the `src/constants.ts` fallback. Keep dependency changes reflected in shared `pnpm-lock.yaml`; it has no app-version field and no npm/site-only lock should be created.
- [x] 3.2 Keep Tauri version sourced from `../package.json` and add/refresh tests that enumerate every version mirror.
- [x] 3.3 Build `mclip-cli` and verify `--version`, `-V`, and `version` return `mclip-cli 0.2.0` without history access.
- [x] 3.4 Update README, PRODUCT, AGENTS, Chinese/English/Japanese website/changelog, `llms.txt`, installer guidance, and Release body from verified capabilities.
- [x] 3.5 Retain accurate macOS notarization, Windows signing, Wayland, Linux architecture, and packaging limitations.

## 4. Automated Release Gates

- [ ] 4.1 Run `pnpm run check` on macOS, Windows, and Linux CI.
- [x] 4.2 Run `node --test tests/*.test.mjs`, `pnpm run cli:test`, installer tests, and migration fixtures on applicable targets.
- [x] 4.3 On macOS with LLVM, the Rust Windows target, and cargo-xwin, run `XWIN_ARCH=x86_64 cargo xwin check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets` and treat it as source evidence only.
- [x] 4.4 Run `pnpm run site:test`, `pnpm run site:build`, `cmp -s install.sh site/public/install.sh`, and `git diff --check`.
- [x] 4.5 Run strict OpenSpec validation for all five v0.2.0 changes.

## 5. Native Packaged Verification Matrix

- [ ] 5.1 Install the release-mode macOS package and record tray, multi-monitor, clipboard, previews, pins, privacy, quick actions, CLI, autostart, and Gatekeeper behavior.
- [ ] 5.2 Install the release-mode Windows x64 package and record the same behaviors plus WebView2, taskbar/DPI, file-list paste, installer, and SmartScreen results.
- [ ] 5.3 Install the Linux x86_64 package on X11/XWayland and record the same behaviors plus selection ownership and panel positioning.
- [ ] 5.4 Install the Linux x86_64 package on every named supported Wayland compositor and record each capability independently.
- [x] 5.5 Leave unavailable, degraded, skipped, and unsupported cells explicit; do not convert automated checks into native passes.

## 6. Draft Release Asset Verification

- [ ] 6.1 With explicit authorization, create/push the exact `v0.2.0` tag that matches the verified release commit without pushing unrelated branch changes.
- [ ] 6.2 Inspect the same Draft Release for every advertised macOS, Windows, and Linux desktop artifact.
- [ ] 6.3 Download every platform CLI binary and `.sha256` companion from the Draft and verify checksum plus `0.2.0` output.
- [ ] 6.4 Run the public installer against the matching Draft/release path on each supported CLI platform and verify user-level atomic replacement/rollback.
- [ ] 6.5 Reconcile any missing format by fixing the build or reducing public claims before publication.

## 7. Release Handoff and Publication Boundary

- [x] 7.1 Produce a final evidence report linking automated logs, native session results, migration results, asset inventory, and remaining limitations.
- [x] 7.2 Verify the release commit and worktree contain only intended v0.2.0 integration changes before any requested commit.
- [x] 7.3 Report exact local commit, tag, Draft, asset, and publication state; do not infer authorization for remote mutations.
- [ ] 7.4 Publish the Draft or replace remote assets only after explicit release-owner authorization and a fresh same-Draft completeness check.
- [x] 7.5 Run `openspec validate prepare-v0-2-0-release --type change --strict` and resolve every validation finding.
