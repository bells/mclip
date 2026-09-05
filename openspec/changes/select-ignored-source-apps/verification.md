# Verification

## Implemented behavior

- Preferences uses an application list with native add and selected-row remove actions. Manual identifier entry is removed.
- The existing serialized settings controller saves only `ignoredSourceAppIds`, including failure rollback. Cancellation and duplicate selection do not save. An over-limit batch leaves existing entries intact.
- `pick_ignored_source_apps(window)` returns `Result<Vec<SourceApplicationOption>, &'static str>`; the TypeScript wrapper invokes `pick_ignored_source_apps` without path arguments. `resolve_ignored_source_apps(window, identifiers)` supplies local display metadata. Both reject non-Preferences callers.
- The official Tauri dialog plugin is registered on the Rust side; no generic frontend dialog/filesystem capability is granted.
- macOS reads bundle identifiers and names with NSBundle and optional PNG icons through NSWorkspace/CGImage. Lowercase legacy IDs use a bounded application-directory fallback when Launch Services lookup cannot resolve original casing.
- Windows derives the executable identity used by the source detector. Linux requires explicit StartupWMClass from a bounded .desktop file; it never executes the launcher or guesses from Exec. Pure Wayland keeps source detection unavailable.

## Passed locally on macOS, 2026-09-05

- `pnpm run check`: frontend build, Rust format, 217 library tests passed / 1 pre-existing ignored, 20 CLI tests, 9 CLI installer tests, Cargo check and clippy with warnings denied.
- `node --test tests/*.test.mjs`: 204 passed, including new merge, capacity and save rollback tests.
- Local AppKit metadata test: TextEdit bundle identity, nonempty name, PNG icon, and resolution from the normalized persisted ID. Non-app selections return content-free errors. Linux launcher parsing and Windows filename derivation also have host-independent unit coverage.
- Playwright with mocked IPC: legacy fallback records, cancellation without saving, batch addition, duplicate suppression, keyboard selection, removal, failed-save rollback, invalid-selection feedback, over-capacity rejection, light/dark appearance and Chinese/Japanese/English rendering.
- Final frontend build and `git diff --check`.
- `openspec validate select-ignored-source-apps --strict`.

## Windows cross-compilation follow-up, 2026-09-05

- Installed user-level `cargo-xwin 0.23.1` with `uv tool install cargo-xwin` (also installed its Ninja dependency). Existing Homebrew LLVM 22.1.7 and the installed Rust Windows target were reused.
- Downloaded Microsoft SDK/UCRT into `~/Library/Caches/cargo-xwin` (approximately 629 MiB after extraction). SDK downloads completed faster over a direct connection than the local proxy.
- `XWIN_ARCH=x86_64 cargo xwin check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets` passed with exit code 0. This includes `ring`, the Tauri dialog dependency and the current application/test targets.
- The toolchain setup removed the missing-header failure without modifying dependency versions, shell profiles, or global Cargo configuration. Use `cargo xwin check` on macOS; plain `cargo check --target` does not automatically activate the SDK.

## Remaining evidence boundaries

- The earlier plain `cargo check --target` failed on missing Windows SDK `assert.h`. The follow-up cargo-xwin all-target check above now passes. Cross-compilation does not run Windows binaries or exercise the native chooser/runtime.
- The owner reported macOS manual validation was "基本没问题" on 2026-09-05. This is owner-reported native smoke evidence; no per-scenario checklist was supplied. Automated browser IPC was mocked and does not independently prove native behavior.
- The owner will perform Windows runtime validation later using Windows installed in Parallels Desktop. That validation is pending. Linux native chooser/runtime checks also remain open. Generic fallback icons on those platforms are intentional.
- Agent-run validation did not change real user settings/history. No commit, push, release operation or OpenSpec archive was performed.
