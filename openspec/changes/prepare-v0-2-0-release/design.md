## Context

The four prerequisite changes alter Linux platform support, persisted history/settings, desktop and CLI output semantics, installers, and Release assets. As reviewed on 2026-09-06, the source version is 0.1.1 across root/site package files and Cargo. The tag-driven workflow configures macOS/Windows packages, Linux x64 `.deb`/AppImage previews, and three platform CLI binaries with checksum companions in one Draft Release. It verifies generated CLI versions and checksums on each runner; same-Draft downloads and native asset validation remain release work. Automated source checks do not prove native tray, transparent-window, clipboard ownership, ignored-app, or Wayland behavior.

This change is a release integration gate, not a container for unfinished feature design. OpenSpec does not enforce cross-change dependencies automatically, so tasks and CI evidence must explicitly verify prerequisite completion.

## Goals / Non-Goals

**Goals:**

- Produce one internally consistent v0.2.0 source tree, documentation set, and Draft Release.
- Prove v0.1.1 data migration and safe default output.
- Record platform-specific evidence and limitations without extrapolation.
- Ensure every advertised binary has a same-version checksum companion and installer mapping.

**Non-Goals:**

- Implementing missing prerequisite capabilities inside this change.
- Publishing a Draft, pushing/replacing tags, moving remote assets, or claiming manual smoke without explicit owner action/evidence.
- Adding AUR, Linux ARM64, signing, notarization, or unsupported Wayland support merely to make the matrix look complete.

## Decisions

### 1. Treat prerequisite OpenSpec states as the first gate

Before version edits, require the four named changes to have all implementation tasks completed or explicitly waived with owner rationale. Run strict validation for each change and review unresolved manual tasks. A green build with incomplete behavioral tasks does not pass this gate.

### 2. Keep `package.json` as product-version truth and verify every mirror

After the prerequisite gate passes, set root `package.json` to `0.2.0`, then synchronize `site/package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src/constants.ts` fallback, CLI binary output, website/changelog, docs, and Release text. `tauri.conf.json` continues to reference `../package.json`; do not duplicate a literal version there. Root `pnpm-lock.yaml` is the shared dependency lock and has no application-version field; update it only as required by dependency changes, without introducing npm or site-only locks.

Existing Release validation compares the tag with root/site manifests, Cargo manifest/lock, and built CLI output before upload. The release gate must also check the frontend fallback and public version mirrors. Version synchronization happens once after prerequisite interfaces stabilize.

### 3. Add explicit v0.1.1 migration fixtures

Create representative text/image/files history and settings fixtures from the v0.1.1 schema with synthetic content. Load them through v0.2.0 and verify default pin/sensitivity/settings values, stable IDs/timestamps/copy counts, no lost paths/assets, no rewrite on read alone, and safe default CLI/UI serialization. Back up real user files before manual upgrade/downgrade smoke.

### 4. Separate automated, packaged, and native-runtime evidence

Maintain a release evidence document with rows for macOS, Windows, Linux X11/XWayland, and each explicitly supported pure-Wayland compositor. For each row distinguish source/unit checks, package installation, clipboard text/image/files round-trip, tray/shortcut, multi-monitor/panel positioning, previews, autostart, pins, privacy masking/ignore capability, quick actions, and CLI pipelines.

Only native device/session results can satisfy runtime rows. Unsupported or unavailable cells stay visible; they are not converted to passes by cross-target compilation.

### 5. Derive public claims and expected assets from the verified matrix

Update README, PRODUCT, AGENTS, Chinese/English/Japanese site/changelog, `llms.txt`, installer usage, and Release body from observed capabilities. Same-Draft completeness verification must check the exact desktop and CLI asset list advertised for macOS ARM64, Windows x64, and Linux x64, including `.sha256` companions and matching CLI version output. This download verification is a required release step, not an existing completed job.

If the Linux runner produces fewer reliable desktop formats than planned, reduce the claims/matrix rather than uploading placeholder artifacts. Keep root and public install scripts byte-identical.

### 6. Preserve release-owner authority boundaries

Local implementation may create commits only when requested. Creating/deleting/replacing/pushing `v0.2.0`, publishing the Draft, and replacing remote assets each require explicit authorization. The handoff reports exact commit/tag/asset state and any manual gaps.

## Risks / Trade-offs

- [Cross-change work is reported complete too early] → Gate on task status, strict validation, and unresolved manual evidence, not just compilation.
- [Version mirrors drift] → Add one workflow test that enumerates all sources and built CLI output.
- [Migration fixtures miss real data shapes] → Cover every current variant and legacy serde aliases with synthetic image assets and malformed-but-recoverable settings.
- [Release claims outrun Wayland evidence] → Generate the support statement from named compositor/session results and retain unsupported rows.
- [Draft asset races leave partial releases] → Upload per platform, then run one same-Draft completeness/checksum/version job before any publication.
- [Downgrade loses new metadata] → Verify older-reader tolerance or publish an explicit backup/transform procedure.

## Migration Plan

1. Complete and validate the four prerequisite changes without changing the public version.
2. Add v0.1.1 migration fixtures and execute automated gates on all CI platforms.
3. Perform and record native packaged smoke on the support matrix.
4. Synchronize 0.2.0 versions, docs, site, installer, and Release copy.
5. Create a local release commit only when requested; create/push the tag and inspect the Draft only with explicit authorization.
6. Publish only after same-Draft asset completeness and all required manual rows pass.

Rollback before publication reverts the release integration commit while preserving feature commits. Rollback after user upgrades requires backed-up v0.1.1-compatible history/settings guidance and must not silently discard v0.2.0 metadata.

## Open Questions

- Which exact Linux desktop artifact formats are observed as reliable on the selected runner and installed smoke hosts?
- Which Wayland compositor/version combinations will be listed as supported rather than experimental?
- Will v0.2.0 remain Draft until macOS/Windows signing decisions change, or retain the current explicit unsigned/ad-hoc distribution policy?
