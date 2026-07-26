# mclip Project Memory

Last refreshed: 2026-07-26

This file records working memory for future maintainers and agents. It is not a replacement for `AGENTS.md` or `README.md`: use those for the live project map, commands, and release-facing docs. Use this file to remember prior decisions, accepted behavior, repeated failure modes, and the user's preferences.

If this file conflicts with live code, trust the live code first, then update this memory.

## Product Shape

`mclip` is a tray-first clipboard history utility for macOS and Windows. It should feel like a compact desktop tool, not a normal always-open app and not a marketing page.

The current stack is React 19, TypeScript, Vite, Tailwind CSS 4, Tauri 2, and Rust. The public site is an Astro app under `site/`. The desktop app is versioned from `package.json`; current version is `0.1.1`.

## v0.1.1 Decisions

- Tailwind CSS owns component styling through utility strings collected in `src/uiStyles.ts`; `src/styles.css` remains the thin global/theme entrypoint. `src/App.css` was deleted.
- All five Tauri windows resolve the same `system | light | dark` appearance setting.
- `mainWindowItemCount` can grow up to sanitized `maxHistoryCount`; `historyGroupItemCount` stays in the compact `5..=20` range.
- Large main-window counts scroll only the middle history/archive region. Search and footer actions remain fixed, and Rust caps native height to the monitor work area.
- `showHistoryItemNumbers` and `showMainWindowBrand` affect presentation only. They do not change stored history or keyboard item positions.
- Archive `preview` renders only the group title/list and reports its rendered natural height. The active row detail lives in the independent `preview-detail` native window.
- Main-item and archive-item details share the same detail panel and detail-owned delete action. Archive rows no longer carry inline delete buttons.
- Color-code and emoji affordances are frontend-only; copy-back always uses the original text.
- `mclip-cli` help/version commands do not read history. The public shell installer prefers matching GitHub Release binaries and falls back to local/source builds.

The GitHub project URL is:

```text
https://github.com/bells/mclip
```

## User Preferences To Preserve

- When the user reports a behavior bug, trace the real code path and interaction path to root cause. Do not stop at a plausible theory.
- If the user says the issue is still the same, especially `还是一样，没有解决`, re-check the running interaction path instead of only rereading the patch.
- If the user resumes with `继续看上一个问题`, continue from the last verified state and preserve earlier findings.
- When the user asks to commit, stage only relevant files, run appropriate verification first, and create a real commit.
- Major repo docs rewrites should usually be bilingual Chinese and English.
- When adding comments for learning TypeScript or React, put teaching-oriented comments directly in TSX files. Explain hooks, props, event objects, controlled inputs, and render structure; avoid trivial narration.
- For UI work, keep the desktop-tool feel: compact, clear, quickly scannable, and consistent with existing rounded transparent popover styling.

## Hard Product Invariants

- Keep the main window fixed width and tray-popover sized. Do not make it resizable.
- Keep preview surfaces in independent transparent Tauri windows. Do not put the right-side preview back into the main window DOM.
- Current window labels are `main`, `preview`, `preview-detail`, `about`, and `preferences`. If this changes, update `src/App.tsx`, `src-tauri/tauri.conf.json`, both capability files, and maintainer docs together.
- `preview` and `preview-detail` must stay non-focusable. If they take focus, the main window can hide itself during hover or selection flows.
- `PREVIEW_WINDOW_GAP` is intentionally `0.0` so the pointer can cross between the main popover and preview without a dead hover gap.
- Language changes must update both Chinese and English strings.
- History data sent to the frontend must keep camelCase fields such as `filePaths`, `imagePath`, `byteSize`, and `contentHash`.

## Preview Window Memory

The preview family is the most timing-sensitive part of the app.

There are two different preview shells:

- Single history item detail: fixed header, scrollable content, fixed action/footer zones.
- History group preview: group title and list first; hover detail appears only after a real hovered row.

Do not merge those shells just because they reuse `HistoryPreviewDetailContent.tsx`. That component is the shared content renderer, not the whole preview UI.

For group preview behavior, accepted UX is:

- Group preview starts close to main-window width.
- It does not preselect the first row.
- It opens an independent `preview-detail` only after a real hover or keyboard activation.
- Row highlight should follow real pointer movement.
- Main-window row highlight and group-preview row highlight should use the same active/hover visual rules for mouse and keyboard. Do not let stale DOM focus draw a second highlighted row.
- Selecting/copying from preview must dismiss the preview completely, with no late reopen.
- Preview detail must never appear by itself after the main window or group preview has hidden. Guard late async show requests in `src-tauri/src/window.rs`, not just in React state.

Important implementation anchors:

- `src/hooks/useHistoryPreviewController.ts` owns preview state, anchor top, dismissal state, request revisions, measured group height, and async show/hide lifecycle; `useClipboardApp.ts` composes it with data/actions.
- `src/utils/previewDismissal.ts` guards against in-flight preview opens and post-selection hover reopen.
- `tests/previewDismissal.test.mjs` is the fast regression guard for dismissal races.
- `src/services/ipc/commands.ts`, `events.ts`, and `windows.ts` own the typed Tauri boundary; `src/lib/tauri.ts` is the compatibility facade used by components.
- `src-tauri/src/window.rs` does native pointer hit testing and window positioning.
- `HistoryGroupPreviewWindow` depends on `data-preview-item-id` and pointer polling through `get_history_preview_pointer_position`; do not replace that with button-only `onMouseEnter`.
- `is_pointer_over_preview_window` must continue checking both `preview` and `preview-detail`.
- Measured group resize must preserve the group window's current X position. Moving it after the detail opens can overlap the independent detail window.
- Detail size and position use the group preview monitor's scale factor and one physical-coordinate transaction. Do not reintroduce a macOS-only post-resize `NSWindow.frame` correction.

Past failure modes:

- DOM event wiring alone was not reliable in transparent, non-focusable Tauri preview windows.
- Hiding the window alone was not enough when async `update -> show` completed late.
- A preview that disappears briefly and then reopens usually means the request lifecycle or selection suppression is wrong.
- A row can look stuck if CSS uses `:focus-within` or item-button `:focus-visible` as the same visual treatment as active selection. Keep keyboard accessibility cues from creating a second row-level highlight.

## Clipboard And History Memory

Clipboard handling lives mainly in `src-tauri/src/clipboard.rs`; persistence lives in `src-tauri/src/history.rs`.

For copied files, especially Finder files on macOS, file-list data must be preferred before image-like data. Otherwise a copied `.txt` file can be missed or misclassified. Keep the single-image-file special case after file-list detection so a copied image file can still become an image history item.

History entries are persisted locally and deduplicated. Repeated content moves to the front and updates count/time. When max history count changes or items are deleted, unused image assets should be cleaned up.

High-value checks:

- File copy classification: look for tests around `clipboard_snapshot_prefers_file_list_over_image_data`.
- Frontend contract: verify serialized Rust payloads use camelCase and still deserialize older snake_case persisted data through aliases where needed.
- If the history detail page is blank, inspect backend JSON shape before assuming React rendering is wrong.

## Diagnostics Memory

The accepted first diagnostics version is offline-first:

- Local logs under `app_handle.path().app_log_dir()`.
- Rust panic capture.
- Frontend runtime capture for `window.error`, `unhandledrejection`, and React `ErrorBoundary`.
- About-window actions for opening the log directory, copying diagnostics, and opening a GitHub issue report.

Important files:

- `src-tauri/src/diagnostics.rs`
- `src/utils/diagnostics.ts`
- `src/main.tsx`
- `src/components/AboutWindow.tsx`

The diagnostic report begins with `mclip diagnostics`. Clipboard ingestion should ignore copied diagnostics text with that prefix so the app does not create self-generated history entries.

For GitHub issue prefills, keep the URL-sized report truncated and leave the full report available through the copy action.

On Windows, prefer opening issue-report URLs with `explorer <url>` over `cmd /C start` to avoid quoting and URL mangling problems.

## About And Preferences Memory

About and Preferences are independent Tauri windows, not main-window modals.

For About:

- Keep GitHub and homepage as explicit buttons; raw URL text is intentionally not shown.
- Keep `APP_NAME` and app version on one line.
- Prefer the real app icon from `src-tauri/icons/128x128.png` for the About identity mark.
- Keep top and bottom spacing comfortable; tiny dialog polish can require adjusting `src-tauri/tauri.conf.json` window height as well as CSS.
- Keep manual update checking explicit. Network access to GitHub Releases should happen only after the user clicks the check action.

For localized About or Preferences copy, update `src/i18n.ts` in both languages.

## Release And Windows Parity Memory

Release-readiness work must include Windows parity and macOS regression avoidance. Windows installability is part of the bar, not a separate afterthought.

Windows coverage should include:

- Tray show/hide.
- `CommandOrControl+Shift+V`.
- Text, image, and file history.
- Search, selection, copy, delete, clear.
- Group preview, item detail preview, and hover detail.
- About and Preferences windows.
- Launch at login.
- Chinese/English UI and system-language default.

2026-07-26 v0.1.1 Windows audit notes:

- The current branch had no GitHub Actions runs yet, so there is no branch-specific Windows runner result to cite.
- Local `cargo check` and `cargo clippy` for `x86_64-pc-windows-msvc` completed successfully on macOS, covering Windows conditional compilation, Win32 API bindings, Tauri dependencies, and the current Rust/TS-facing native commands.
- `cargo test --target x86_64-pc-windows-msvc --all-targets --no-run` compiled the dependency and application graph to the final link step, then stopped because this macOS host does not have the MSVC `link.exe`. No Rust compile diagnostic appeared before that host-tool boundary.
- This cross-target compile does not verify Explorer clipboard behavior, tray interaction, WebView2 rendering, multi-monitor DPI placement, Startup-folder launch, installer UX, or SmartScreen on a real Windows system. The `windows-2022` CI/release jobs and a Windows smoke pass remain the release authority.
- The published `v0.1.0` release was verified to contain Windows installer assets `mclip_0.1.0_x64-setup.exe` and `mclip_0.1.0_x64_en-US.msi`; the corresponding `publish (windows-2022)` release job succeeded. This does not replace creating a fresh tag for later commits.
- The public shell installer handles the Windows `.exe` name correctly, but its `curl ... | sh` entrypoint requires Git Bash or another POSIX-compatible shell; normal desktop installation continues through the `.msi`/`.exe` assets.
- Windows installability remains unsigned/SmartScreen-limited, with WebView2 `downloadBootstrapper` configured for missing runtime installs.

Current release constraints:

- macOS builds use ad-hoc signing and are not notarized. Users may need to remove quarantine after downloading from GitHub.
- Windows builds are unsigned and may trigger SmartScreen.
- Windows installer uses WebView2 `downloadBootstrapper` in silent mode, so first install may need network access if WebView2 is missing.
- GitHub Actions uses `macos-latest` and `windows-2022`; the Windows CI lane is the real Windows bundling check.

Known environment caveats:

- Windows-target test linking requires the MSVC Rust target plus Visual Studio's `link.exe`, which is not available on a normal macOS host. Keep successful cross-target `check`/`clippy` separate from this expected host linker limitation.
- Native dev launch can be blocked by local sandbox binding issues such as `listen EPERM ... :1420`. In that case, use repo-native checks and separate the environment issue from app code.
- Local packaging failures, especially DMG creation, can be environment-specific. Separate packaging environment problems from code regressions early.

## Verification Memory

Full gate:

```bash
npm run check
```

This runs frontend build, Rust format check, Rust tests, Rust compile check, and clippy. Prefer it before commit.

Fast checks:

```bash
npm run build
node --test tests/previewDismissal.test.mjs
cargo check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
npm run site:test
npm run site:build
git diff --check
```

Use `npm run build` first for TSX/CSS-only UI edits. Use `git diff --check` after broad docs/config changes. Use targeted tests when tracing a specific bug, then run the full gate when feasible.

If a full check fails, separate baseline or environment failures from the files touched in the current task before blaming the new change.

## Code Areas To Search First

- Preview bugs: `src/hooks/useHistoryPreviewController.ts`, `src/services/ipc/commands.ts`, `src/services/ipc/events.ts`, `src/utils/preview.ts`, `src/utils/previewDismissal.ts`, `src/utils/previewHistory.ts`, `src/components/HistoryGroupPreviewWindow.tsx`, `src/components/HistoryPreviewWindow.tsx`, `src/components/HistoryPreviewDetailWindow.tsx`, `src-tauri/src/window.rs`, and the preview/group sizing tests.
- Clipboard/history bugs: `src-tauri/src/clipboard.rs`, `src-tauri/src/history.rs`, `src/types.ts`, `src/components/HistoryPreviewDetailContent.tsx`.
- Diagnostics bugs: `src-tauri/src/diagnostics.rs`, `src/utils/diagnostics.ts`, `src/main.tsx`, `src/components/AboutWindow.tsx`.
- Settings bugs: `src-tauri/src/settings.rs`, `src/utils/settings.ts`, `src/components/PreferencesWindow.tsx`, `src/constants.ts`.
- Window/config/capability drift: `src/App.tsx`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/capabilities/desktop.json`, `src-tauri/src/lib.rs`, `src-tauri/src/window.rs`.
- Release docs: `README.md`, `AGENTS.md`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`.

## Do Not Forget

- Preserve user worktree changes that are unrelated to the task.
- Prefer `rg` for searching.
- Use `apply_patch` for manual edits.
- Update command names/events in `src/services/ipc/*`, the `src/lib/tauri.ts` compatibility facade, and Rust `generate_handler!` together.
- When adding Tauri API calls or windows, update capabilities and window label routing.
- Keep docs aligned with the live tree; stale docs have caused confusion before.
