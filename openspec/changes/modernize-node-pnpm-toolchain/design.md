## Context

CI and release already select Node.js 24 through `actions/setup-node`, and the README names Node.js 24, but the two package manifests have no `engines` or package-manager declaration. A hosted builder can therefore choose its default runtime, including deprecated Node.js 20, while local development currently depends on whichever `node`, `npm`, and package-lock implementation happens to be installed.

The application and Astro website are related release surfaces but currently have separate npm lockfiles. Root scripts shell back into `site/` with npm, Tauri invokes npm before dev/build, GitHub Actions caches npm and runs `npm ci`, the release workflow reads npm-only lockfile fields, and product/docs strings teach npm commands. This is a cross-cutting build-system migration; it does not change runtime application architecture or published user data.

The audited local environment is Node.js 22.22.1 with pnpm 10.33.0, while the repository automation is already on Node.js 24. Implementation verification therefore needs an actual Node.js 24 shell rather than treating the current local Node.js 22 result as sufficient.

## Goals / Non-Goals

**Goals:**

- Make Node.js 24 the explicit, machine-readable runtime contract for the root application, website, local version managers, CI, release, and Vercel.
- Make pnpm 10.33.0 the exact supported package-manager implementation and expose the pin through standard package metadata.
- Represent the root application and `site/` as a single pnpm workspace with one deterministic lockfile and frozen installs in automation.
- Convert all active build entry points, contributor commands, localized development copy, and source-contract tests from npm to pnpm.
- Preserve release version truth in `package.json`, `site/package.json`, Cargo metadata, and `Cargo.lock` without pretending that pnpm records importer package versions in its lockfile.

**Non-Goals:**

- Upgrading JavaScript dependencies, React, Astro, Tauri, Rust, or the product version.
- Changing desktop behavior, IPC contracts, clipboard persistence, CLI semantics, website content beyond toolchain commands, or installer behavior.
- Supporting simultaneous npm and pnpm workflows or retaining generated npm lockfiles as a fallback.
- Moving the Rust crates into a JavaScript workspace or adopting a larger monorepo orchestrator such as Turborepo.

## Decisions

### 1. Standardize on the Node.js 24 LTS major

Both package manifests will declare `engines.node` as `>=24 <25`, and the repository will add a root `.node-version` containing `24`. CI and release retain `actions/setup-node@v6` with Node 24. The website manifest repeats the engine contract because Vercel can build with `site/` configured as its project root and must not depend on reading only the parent manifest.

This chooses the already-tested LTS major instead of Node.js 22, which would move automation backward, or the current non-LTS major, which would increase churn. The upper bound is intentional: a future major requires an explicit compatibility change rather than silently changing CI or hosting behavior.

### 2. Pin pnpm 10.33.0 in package metadata

The root `package.json` will declare `packageManager: "pnpm@10.33.0"`; `site/package.json` will mirror the declaration for standalone hosted-root detection. Local setup will use Corepack to activate that exact version under Node.js 24. GitHub Actions will use `pnpm/action-setup@v4` and derive the requested version from repository metadata before `actions/setup-node` enables the pnpm store cache.

An exact pin is preferred over a range so developers, CI, release, and Vercel produce the same lockfile format and peer-resolution behavior. npm is not retained as a second supported path because dual lockfiles inevitably drift. pnpm 11 is deferred because this change is a package-manager migration, not an additional major-version adoption with no existing repository evidence.

### 3. Use one pnpm workspace and one root lockfile

A root `pnpm-workspace.yaml` will include `site`. Running `pnpm install` at the repository root will resolve the root importer and `site` importer into one `pnpm-lock.yaml`. Both `package-lock.json` files will be removed after generating the new lock from the unchanged manifests.

Root convenience scripts remain the public command surface, but nested website scripts will use pnpm workspace-aware execution (for example, `pnpm --dir site run build`). This keeps existing command names such as `site:build` stable while eliminating a nested npm install boundary. Keeping two pnpm lockfiles was considered, but it would preserve duplicate dependency resolution and make root CI unable to prove the whole repository is frozen in one install.

### 4. Make every executable build path pnpm-native

Package scripts that recursively call npm will call pnpm; Tauri `beforeDevCommand` and `beforeBuildCommand` will use pnpm; CI/release will run `pnpm install --frozen-lockfile` and `pnpm run ...`; setup-node caching will use `cache: pnpm` with the root lockfile as its dependency path. Vercel will be given an explicit Node/pnpm contract through `site/package.json` and, where needed, explicit install/build commands in `site/vercel.json` so it cannot fall back to npm based on stale detection.

README, AGENTS, OpenSpec project context, Linux documentation, localized application strings, and localized website development copy will show pnpm commands. Historical archived OpenSpec evidence and performance reports remain immutable descriptions of commands that were actually run at the time.

### 5. Separate product-version validation from dependency-lock validation

The release job will continue comparing the tag against the root package version, website package version, Cargo package version, and Cargo lock package version. It will remove `package-lock.json` version reads because pnpm's lockfile importer records dependency resolution, not the package manifest's own version as an authoritative release field.

Dependency-lock consistency is instead proven earlier by `pnpm install --frozen-lockfile`; it fails if either workspace manifest and the committed lockfile disagree. A focused source-contract test will assert that both workspace importers exist, npm lockfiles are absent, active automation uses pnpm/Node 24, and Tauri hooks and canonical documentation no longer instruct npm.

## Risks / Trade-offs

- [Developers on Node.js 22 or without Corepack cannot immediately run the new commands] → Document Node.js 24 plus `corepack enable`, provide `.node-version`, and fail early through `engines` rather than producing an ambiguous dependency failure.
- [Vercel may treat `site/` as an isolated root and miss parent workspace metadata] → Mirror runtime/package-manager metadata in `site/package.json`, retain `site` as a workspace importer, and explicitly verify a production site build from the deployment working-directory model.
- [pnpm's stricter dependency isolation can reveal undeclared transitive imports] → Generate the lockfile without dependency upgrades, run the frontend, site, Node, CLI, Rust, and Tauri gates, and declare any actually used missing dependency instead of enabling broad hoisting.
- [Corepack availability changes in future Node distributions] → Node.js 24 is the bounded contract for this change; CI also uses `pnpm/action-setup`, and a later Node-major proposal can adopt a different bootstrap mechanism.
- [A broad text replacement could rewrite historical verification evidence or shell examples that are not package-manager commands] → Limit migration checks to active manifests, workflow/config files, canonical developer documentation, localized current-product copy, and tests; review diffs rather than rewriting archived records mechanically.
- [One lockfile couples root and website dependency updates] → Accept the coupling because both surfaces ship from one repository and release together; use pnpm filters or `--dir site` for focused commands when only one importer needs execution.

## Migration Plan

1. Add the Node.js and pnpm metadata plus `pnpm-workspace.yaml`, activate the pinned pnpm under Node.js 24, generate the root `pnpm-lock.yaml`, and confirm it contains `.` and `site` importers without changing declared dependency versions.
2. Convert root scripts, Tauri hooks, CI, release, and Vercel configuration to pnpm. Replace npm-lock version checks with manifest checks plus the frozen workspace install.
3. Remove root and website `package-lock.json` files, then update source-contract tests, README, AGENTS, OpenSpec project context, Linux docs, and all Chinese/English/Japanese current-product command copy.
4. Verify under Node.js 24 with a clean `pnpm install --frozen-lockfile`, the full application gate, all root Node tests, CLI tests, site tests/build, Windows target check where supported, Linux bundle path in CI, strict OpenSpec validation, and `git diff --check`. Confirm the Vercel build uses Node.js 24 and pnpm before deployment is considered proven.
5. If the migration must be rolled back before release, restore both npm lockfiles and the npm workflow/config commands together in one revert. No application data rollback is required because the change does not alter shipped runtime state.

## Open Questions

None. Node.js 24 is already the repository's CI/release baseline, and pnpm 10.33.0 is the audited package-manager version selected for a reproducible first migration.
