# Maple Icon Refresh Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the approved icon scope inline. Steps use checkbox syntax for tracking.

**Goal:** Ship the selected second maple+m mark across desktop and current static website assets.

**Architecture:** Reuse all existing asset paths and tray settings. A canonical selected PNG and the official Tauri CLI produce the color, template and contrast exports; React/Rust contracts remain unchanged.

**Tech Stack:** Node 24, pnpm, Tauri 2 icon CLI, PNG/SVG export wrappers, existing TypeScript dictionaries and Node tests.

**Spec:** `openspec/changes/refresh-maple-icon-identity/design.md` and `specs/appearance-settings/spec.md`.

## Global Constraints

- Work in the user-created `v1.0.0` branch, preserving the existing uncommitted tray repair.
- Preserve `appIcon | light | m`, default `light`, and all notebook icon bytes.
- No hand-drawn approximation of the selected mark, new dependencies, updater work, version bump, installation, commits or pushes.
- Preserve historical screenshots/videos and current website layout/theme.
- Native evidence is separate from exports, browser checks and builds.

## Review Focus

- Packed ICO/ICNS and website files must not retain green branding.
- The m cutout and transparency must survive small-size export.
- Template and color silhouettes must match.
- Re-running generators must preserve notebook assets and the warm leaf contrast surface.
- Old settings must remain accepted without migration.

## Task 1: Reproducible icon assets

**Files:** `scripts/generate-maple-icons.mjs`, `src-tauri/icons/source/maple-app.png`, desktop/leaf derivatives, `site/public/app-icon.png`, `tests/mapleIconAssets.test.mjs`, `tests/helpers/png.mjs`.

**Interfaces:** consumes the exact selected PNG; produces the existing desktop/website paths and 16/18/22px previews.

- [x] Add pixel/alpha/packed-format checks; observe the old green assets fail the new palette contract.
- [x] Implement deterministic exports with the official Tauri CLI and a source-image monochrome filter.
- [x] Generate assets, verify palette/alpha, and inspect actual-size and enlarged previews.
- [x] Check notebook file hashes against the pre-change baseline.

## Task 2: Labels and project records

**Files:** `src/i18n/{zhCn,en,ja}.ts`, `scripts/generate-menu-bar-m-icon.mjs`, `package.json`, project docs, roadmap, and this OpenSpec change.

**Interfaces:** retains existing settings values and stable asset imports; publishes `icons:generate-maple`.

- [x] Update three-language maple labels, preserving the notebook shape and settings contract.
- [x] Keep the notebook generator's leaf contrast colors consistent with the maple exporter.
- [x] Update the icon scope, selected-source provenance and reproduction instructions.

## Task 3: Verify and review

- [x] Run `pnpm run check`, root Node tests, Windows x64 all-target check, then `site:test` and `site:build` serially.
- [x] Check repeatable exports, notebook hashes and `git diff --check`.
- [x] Inspect the website logo and the icon preview; record native acceptance as pending where unavailable.
- [x] Obtain a fresh read-only review of the icon diff and fix material findings.

## Execution ledger

- Approved: owner selected the second displayed generated image; latest scope retains all three tray choices.
- Ruling: execute in the explicitly requested branch in place, carrying existing edits. No additional worktree or commits are required for this asset change.
- Ruling: use deterministic source-image exports after rejecting the noisy generated white conversion; the selected source geometry remains authoritative.

- Task 1: complete — asset tests changed from red to green; the selected source and notebook hashes were verified; all 24 audited output files are stable across consecutive exports.
- Task 2: complete — three-language labels and project records updated, existing setting values retained.
- Task 3: complete for automated/static QA — full checks, root 235 tests, website 16 tests/build, Windows check and fresh independent review passed. Native platform tasks stay open in OpenSpec.
- Ruling: normalize unchanged ICNS records after confirming only record order differed across exports; this preserves all image payloads and makes the package export repeatable.
- Delivery authorization: on 2026-10-25, the owner subsequently requested committing the approved work and pushing `v1.0.0`. That delivery is separate from the implementation-stage restrictions above; native acceptance, installation and release remain separate.
