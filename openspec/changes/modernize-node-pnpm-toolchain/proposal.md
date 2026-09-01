## Why

The repository already runs CI and release builds on Node.js 24, but local and hosted environments do not declare that runtime consistently, allowing platforms to fall back to deprecated Node.js 20 or developers to use a different major. Dependency management is also split across two npm lockfiles, so moving to one pinned pnpm toolchain will make installs, caches, Tauri hooks, website builds, and release checks reproducible from the same dependency graph.

## What Changes

- Standardize development, CI, release, and Vercel website builds on Node.js 24 LTS, with repository metadata that rejects unsupported Node major versions instead of relying on platform defaults.
- **BREAKING** Replace npm as the supported repository package manager with a pinned pnpm version, remove npm lockfiles, and update contributor commands, scripts, Tauri build hooks, tests, and automation to use pnpm.
- Manage the root application and `site/` as one pnpm workspace with one frozen workspace lockfile while preserving their separate package manifests and build outputs.
- Update release validation to remove npm-specific lockfile version reads, keep product-version checks against authoritative manifests, and use a frozen pnpm install to prove the workspace lockfile matches both importers.
- Add regression checks that prevent active automation and developer documentation from drifting back to npm or Node.js 20.

## Capabilities

### New Capabilities

- `javascript-toolchain`: Defines the supported Node.js runtime, pinned pnpm package manager, workspace dependency graph, frozen installation behavior, and automation/documentation consistency requirements.

### Modified Capabilities

- None.

## Impact

- Root and website package metadata and dependency locks: `package.json`, `site/package.json`, new pnpm workspace/lock metadata, and removal of both `package-lock.json` files.
- Developer and Tauri entry points: root scripts, `src-tauri/tauri.conf.json`, `README.md`, `AGENTS.md`, and `openspec/project.md`.
- Delivery automation: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, release version checks, pnpm cache setup, and Vercel package-manager/runtime detection for `site/`.
- Source-contract tests and other active documentation that assert npm commands or lockfile names.
- No clipboard behavior, IPC contract, persisted user data, desktop UI, CLI command semantics, or published installer behavior changes.
