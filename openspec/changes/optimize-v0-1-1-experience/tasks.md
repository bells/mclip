## 1. Compact Main History Groups

- [x] 1.1 Change the archive group list spacing in `src/uiStyles.ts` so consecutive group rows have no extra vertical gap while preserving the existing 34px row target and state styling.
- [x] 1.2 Extend `tests/historyDisplay.test.mjs` or focused layout coverage to assert the compact archive-list class and preserved archive-row geometry.
- [ ] 1.3 Smoke-test multiple archive groups with mouse and keyboard, confirming hover/focus previews remain independently positioned and adjacent active rows remain distinguishable in light and dark themes.

## 2. Align Preferences General Controls

- [x] 2.1 Refactor `src/components/PreferencesWindow.tsx` so Language, Appearance Theme, and Menu Bar Icon render in one horizontal three-column strip, with a reusable inline label/selector pair and programmatic label association in each column.
- [x] 2.2 Replace the menu bar icon radio buttons with a compact image-only dropdown for `appIcon`, `light`, and `m`, including localized accessible names and keyboard behavior, while reusing `updateMenuBarIconStyle` and the existing immediate-save settings flow.
- [x] 2.3 Update `src/uiStyles.ts` and the fixed Preferences window width for three usable bilingual columns, substantially shorten the language/theme controls, and make the menu bar icon selector narrower still.
- [x] 2.4 Update `tests/preferencesGeneralLayout.test.mjs` and related Preferences tests to cover row alignment, compact control widths, image-only icon choices, accessible labels, and unchanged settings persistence.
- [x] 2.5 Fix WebView focus-transition dismissal so pointer selection commits before the image dropdown closes, and prevent dropdown Escape from closing the Preferences window.
- [ ] 2.6 Run a Preferences smoke test on macOS and record Windows native-select/layout verification as a Windows CI or device coverage item if no Windows environment is available.

## 3. Protect CLI Version Behavior

- [x] 3.1 Confirm the real `mclip-cli` binary continues to support `--version`, `-V`, and `version` with identical package-version output and status `0`.
- [x] 3.2 Extend `src-tauri/tests/agent_cli.rs` so each version entry point succeeds with a nonexistent/unreadable history path, proving version reporting remains history-independent.

## 4. Make Public Installer Fallback Deterministic

- [x] 4.1 Refactor `download_prebuilt_binary` in `install.sh` to classify the final HTTP status independently from curl code 22, accepting only successful transfers, returning fallback on final 404, and treating incomplete transport as fatal.
- [x] 4.2 Preserve fail-closed checksum behavior: a downloaded binary with a missing, malformed, or mismatched `.sha256` must not enter source fallback as a successful prebuilt install and must not replace the existing CLI.
- [x] 4.3 Extend `tests/installScript.test.mjs` with controlled curl fixtures for 2xx success, final 404 with exit 22, final 404 with a nonstandard exit code such as 56, non-404 HTTP failure, interrupted transport, missing checksum, and pinned-version URL behavior.
- [x] 4.4 Copy the validated root installer to `site/public/install.sh` and add/retain the byte-for-byte equality assertion.

## 5. Gate Release Asset Completeness

- [x] 5.1 Update `.github/workflows/release.yml` to assert each prepared CLI binary and checksum exists locally and validates before upload, and make unmatched upload paths fail the job.
- [x] 5.2 Add a job after the macOS and Windows matrix completes that queries the tag's draft Release and fails with explicit names unless all four expected CLI binary/checksum assets are present.
- [x] 5.3 Add a deterministic local/YAML test or script for the expected macOS ARM64 and Windows x64 asset matrix so installer and workflow names cannot drift.
- [x] 5.4 Document the v0.1.1 release-readiness command and the boundary that publishing, moving a tag, or repairing remote assets requires a separate explicitly authorized release operation.

## 6. Verification and Release Handoff

- [x] 6.1 Run focused frontend, Preferences, CLI, installer, and release-workflow tests, including `npm run cli:test` and the relevant Node test files.
- [x] 6.2 Run `npm run check`, `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc`, `npm run site:test`, `npm run site:build`, and `git diff --check`, recording the macOS cross-target coverage limit. The macOS cross-target command reached `ring` and stopped because the local MSVC target lacks Windows C headers (`assert.h`); Windows CI/device validation remains required.
- [x] 6.3 Run `openspec validate optimize-v0-1-1-experience --type change --strict`.
- [ ] 6.4 Before claiming the public install issue resolved, verify the deployed `https://www.mclip.cn/install.sh`, the public/draft Release asset set as appropriate, and a real macOS installation path; leave remote v0.1.1 repair/publication pending unless separately authorized.
