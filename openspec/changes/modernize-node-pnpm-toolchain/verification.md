## Verification Environment

- Date: 2026-09-01
- Host: macOS ARM64
- Node.js: v24.20.0 (official `nodejs.org` archive, SHA-256 verified)
- pnpm: 10.33.0 through Corepack
- Workspace lock SHA-256 before and after gates: `886700dddab706b05ab5558b3369a1db4bd4c67d22f921e44b6dbdc6d1e82be2`

## Passed Gates

- `pnpm install --frozen-lockfile`; the second pass ran only the explicitly allowed `esbuild` and `sharp` install scripts and did not modify `pnpm-lock.yaml`.
- `pnpm run check`: frontend production build; Rust formatting; 210 Rust tests passed with 1 benchmark ignored; Cargo check; clippy with warnings denied.
- `node --test tests/*.test.mjs`: 193 passed.
- `pnpm run cli:test`: 20 passed.
- `pnpm run site:test`: 16 passed.
- `pnpm run site:build`: six localized routes built from the root script and directly from the `site/` working directory.
- JavaScript toolchain source-contract coverage confirms Node/pnpm metadata, workspace importers, lockfile policy, build-script allowlist, Tauri hooks, CI/Release, Vercel, and canonical documentation.
- `git diff --check` passed.

## Platform Boundaries

- `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc` reached `ring v0.17.14` and stopped because the macOS host lacks the Windows C header `assert.h`. This is the repository's documented cross-target host-toolchain limitation; Windows CI and a Windows runtime smoke remain required.
- Linux CI/bundle commands are covered by source-contract tests, but a macOS run does not prove the Ubuntu package build or Linux desktop behavior.
- The Vercel `site/` working-directory production build passed locally with Node 24/pnpm 10.33.0. A real hosted deployment remains the proof of Vercel runtime selection and install-log behavior.
