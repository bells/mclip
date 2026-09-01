## 1. Declare the Node and pnpm workspace contract

- [x] 1.1 Add a root `.node-version` for Node.js 24 and add matching `engines.node` plus exact `packageManager: "pnpm@10.33.0"` metadata to both `package.json` and `site/package.json`.
- [x] 1.2 Add `pnpm-workspace.yaml` with the `site` package, activate the pinned pnpm under Node.js 24, and generate one root `pnpm-lock.yaml` containing both `.` and `site` importers without upgrading declared dependencies.
- [x] 1.3 Remove the root and website `package-lock.json` files and confirm a clean `pnpm install --frozen-lockfile` leaves the workspace lockfile unchanged.

## 2. Convert executable build and delivery paths

- [x] 2.1 Convert npm-recursive root scripts and the Tauri `beforeDevCommand`/`beforeBuildCommand` hooks to pnpm while preserving all existing public script names and underlying commands.
- [x] 2.2 Update CI and release workflows to prepare the pinned pnpm, cache the pnpm store against the root lockfile, install with `--frozen-lockfile`, and run all existing checks/builds through pnpm on macOS, Windows, and Linux.
- [x] 2.3 Refactor release tag validation to compare only the root/site manifests and Cargo version sources, removing npm-lock parsing while keeping frozen workspace installation as the dependency consistency gate.
- [x] 2.4 Make the Vercel website build explicitly select Node.js 24 and the pinned pnpm/workspace install path, then verify the configured `site/` working-directory build produces the Astro output.

## 3. Migrate active guidance and localized command copy

- [x] 3.1 Replace npm commands and lockfile guidance in `README.md`, `AGENTS.md`, `openspec/project.md`, `docs/linux-support.md`, and other canonical active developer instructions with the Node.js 24/Corepack/pnpm workflow, leaving historical archived evidence unchanged.
- [x] 3.2 Update the Chinese, English, and Japanese application strings and website source copy that name `npm run tauri:dev` so every current product surface teaches the pnpm command consistently.

## 4. Add regression coverage and verify the migration

- [x] 4.1 Add a JavaScript toolchain source-contract test covering both engine declarations, the exact pnpm pin, `.node-version`, workspace importers, single-lockfile policy, frozen automation installs, Tauri hooks, release version sources, Vercel configuration, and canonical command guidance.
- [x] 4.2 Update existing Linux/automation source-contract assertions from npm to pnpm and run all root `node --test tests/*.test.mjs` tests.
- [x] 4.3 Under Node.js 24 with pnpm 10.33.0, run `pnpm run check`, `pnpm run cli:test`, `pnpm run site:test`, `pnpm run site:build`, and `git diff --check`; confirm the frozen install and all generated outputs leave `pnpm-lock.yaml` unchanged.
- [x] 4.4 Run `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc` where supported, verify the Linux bundle job and Vercel build use the new toolchain, and record that CI/hosted builds do not replace Windows/Linux desktop or deployment-runtime smoke.
- [x] 4.5 Run `openspec validate modernize-node-pnpm-toolchain --type change --strict` and resolve all proposal, design, spec, and task validation errors before implementation is considered complete.
