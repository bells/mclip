## Why

The v0.2.0 capabilities touch persisted data, three desktop platforms, CLI contracts, installers, and public documentation, so a feature-complete branch is not automatically release-ready. A separate integration change is needed to synchronize versions and product truth, prove migration and asset completeness, and prevent unsupported Linux or privacy claims from reaching the Release.

## What Changes

- Gate v0.2.0 integration on completion of `add-linux-desktop-support`, `add-pinned-history-items`, `add-sensitive-content-protection`, and `add-text-quick-actions-and-pipelines`.
- Synchronize the product version across root/site packages, Cargo manifest/lock, the frontend fallback, Tauri's package reference, CLI output, website/changelog, docs, and Release copy. Keep dependency changes consistent with the shared root pnpm lockfile.
- Add migration fixtures from v0.1.1 history/settings and verify no data loss, unexpected rewrite, or secret exposure in default desktop/CLI presentation.
- Run the full macOS, Windows, Linux X11, and supported Wayland verification matrix, keeping native-runtime/manual boundaries explicit.
- Verify the same Draft Release contains every advertised desktop package, CLI binary, and `.sha256` companion and that installers download only matching-version assets.
- Publish only claims backed by current evidence; AUR, Linux ARM64, notarization, Windows signing, unsupported Wayland compositors, and source-app blacklist gaps remain explicit limitations unless separately completed.
- Keep tag creation, tag replacement, Draft publication, and remote asset mutation as release-owner actions requiring explicit authorization.

## Capabilities

### New Capabilities

- `v0-2-0-release-readiness`: Cross-change dependency gates, version synchronization, migration evidence, platform verification, asset completeness, public claim accuracy, and release authority boundaries.

### Modified Capabilities


## Impact

- All version-bearing manifests and Cargo lockfile, Release workflow and body, installers, README/PRODUCT/AGENTS, Chinese/English/Japanese website/changelog, `llms.txt`, and release/migration fixtures; shared `pnpm-lock.yaml` when dependencies change.
- CI plus native macOS, Windows, X11, and Wayland smoke protocols; Draft Release inspection and checksums.
- No feature implementation should originate here beyond integration fixes required to satisfy the four prerequisite changes.
