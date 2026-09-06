# Project Context

Reviewed against source on 2026-09-06. This is implementation context for new changes; it does not certify a release. See [the OpenSpec index](README.md) for baseline specs, active changes, and evidence boundaries, and [AGENTS.md](../AGENTS.md) for the detailed code map.

项目上下文：源码版本仍为 `0.1.1`；七个窗口、中英日三语及面向 `0.2.0` 的新增功能已进入代码。Linux 为待原生验收的 x64 预览实现。规格校验、功能实现、原生验收和发布状态分别记录。

## Purpose

`mclip` is a local-first, tray-first clipboard history app for macOS and Windows,
with a Linux x86_64 preview implementation pending native session verification.
It is designed as a compact desktop utility, not a full-size always-open window.
The core product promise is fast access to recent clipboard history, safe local
persistence, and reliable restore of text, images, and copied files.

The app should stay quiet and utilitarian: users open it from the menu bar,
system tray, or `CommandOrControl+Shift+V`, pick or search a history item, and
return to their current work with minimal interruption.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4.
- Desktop shell: Tauri 2.
- Backend: Rust 2021.
- CLI: Rust binary `mclip-cli` in the same Cargo package.
- Website: Astro 6 static site under `site/`, with `/zh/`, `/en/`, and `/ja/` routes.
- CI and release: GitHub Actions, `tauri-apps/tauri-action`, Node `>=24 <25`, pnpm 10.33.0, Rust stable.
- Root `pnpm-lock.yaml` is shared by the workspace; do not create npm or site-only lockfiles.
- Core frontend dependencies: `@tauri-apps/api`, `@tauri-apps/plugin-positioner`,
  `react`, and `react-dom`.
- Core Rust dependencies: `tauri`, `serde`, `serde_json`, `arboard`, `image`,
  `sha2`, `base64`, `tauri-plugin-global-shortcut`,
  `tauri-plugin-single-instance`, `tauri-plugin-positioner`,
  `tauri-plugin-dialog`, Linux `tauri-plugin-autostart`, `raw-window-handle`,
  and platform-specific macOS/Windows/Linux APIs.

## Product Model

- `mclip` runs from the macOS menu bar, Windows tray, or the Linux desktop's available tray integration; Linux capability degradation must remain visible.
- The main window is compact, fixed-width, transparent, rounded, and hidden by
  default.
- Clipboard history supports text, images, and files.
- File history must be restored as a system file list, not as plain path text.
- History is local only. `history.json`, `settings.json`, and image assets live
  in the local app config directory.
- Duplicate ordinary clipboard content is moved back to the top. Pins are ordered by most recent pin time before ordinary history; duplicate copying preserves pin time. Up to 100 pins are retained independently of ordinary limits.
- Main-window and archive-group visible item counts default to `10` and `50`
  respectively. Main count accepts `5..=maxHistoryCount`; group count accepts `5..=100`. Ordinary retention defaults to 200 and accepts `10..=500`.
- Preferences include launch at login, language, appearance theme, menu bar icon
  style, auto paste, max history count, visible counts, row number visibility,
  main-window branding, enabled history types, sensitive masking, ignored source
  applications, and `textQuickActions` (`json`, `base64`, `urlComponent`).
- Preferences is a searchable six-destination settings center with immediate,
  serialized saving and failure rollback. Native ignored-app selection stores only
  normalized IDs; metadata is local and invalid entries remain removable.
- Sensitive classification is local and bounded to 64 KiB. Fixed display masking
  is not encryption; explicit copy/reveal uses originals. Reading legacy history
  must not reclassify or rewrite it. Pure Wayland source exclusion is unavailable.
- Text quick actions and CLI transformations share bounded pure Rust operations;
  copying a result writes the system clipboard, while replacing history requires confirmation.
- The app supports Chinese, English, and Japanese UI; user-facing copy changes
  must update all three parity-checked catalogs. Follow System resolves `zh`
  locales to Chinese, `ja` locales to Japanese, and unsupported locales to
  English. CLI command names, help, and output remain English-first.
- The public website and `llms.txt` should stay aligned when public product,
  install, or CLI behavior changes.

## Architecture

### Frontend

- `src/main.tsx` bootstraps the current window through `src/windowRoutes.ts`, which
  dynamically imports `main`, `preview`, `preview-detail`, `image-viewer`,
  `about`, `quick-action`, or `preferences`. `src/App.tsx` owns the main shell.
- `src/types.ts` contains the canonical TypeScript side of Rust/TS IPC payloads.
- `src/services/ipc/commands.ts`, `events.ts`, and `windows.ts` own typed Tauri
  boundaries; `src/lib/tauri.ts` is the compatibility facade.
- Main app state is orchestrated by `src/hooks/useClipboardApp.ts`, with focused
  controllers for data, preview, and actions.
- Pure behavior should be extracted to `src/utils/` when it needs regression
  coverage or crosses UI component boundaries.
- UI components should remain focused: components render, hooks orchestrate
  state and effects, services talk to Tauri.
- `src/components/preferences/` provides navigation, search, reusable controls,
  ignored applications, and `preferenceSaveController.ts`; preserve immediate-save
  ordering and rollback when refactoring `PreferencesWindow.tsx`.
- `src/utils/mainWindowShortcuts.ts` is the shared footer shortcut display/action
  contract. Use concise labels and visible keycaps; clearing still confirms.

### Rust/Tauri

- `src-tauri/src/lib.rs` owns Tauri app setup, tray/menu behavior, commands,
  global shortcuts, and native shell integration.
- `src-tauri/src/window.rs` owns window sizing, positioning, hit testing, and
  preview placement.
- `src-tauri/src/clipboard.rs` owns clipboard read/write behavior and platform
  clipboard watching.
- `src-tauri/src/history.rs` owns history persistence, dedupe, migration,
  truncation, and image asset cleanup.
- `src-tauri/src/settings.rs` owns settings persistence, defaults,
  sanitization, language defaults, and launch-at-login behavior.
- `src-tauri/src/agent_cli.rs` owns the CLI and Agent-facing command surface.
- `src-tauri/src/desktop_state.rs` owns revisioned history/settings state, serialized
  mutations, and external-file reconciliation. Normal history changes use targeted
  deltas; full replacements are reserved for reconciliation.
- `src-tauri/src/auxiliary_window_contract.rs` owns auxiliary descriptors and the
  ready generation registry; `auxiliary_windows.rs` creates/reuses the windows.
- `src-tauri/src/image_cache.rs` provides single-flight image reads capped at
  32 MiB total and 8 MiB per item, invalidated alongside history resource cleanup.
- `src-tauri/src/text_transform.rs`, `sensitive_content.rs`, `ignored_apps.rs`,
  `desktop_capabilities.rs`, and `cli_install.rs` isolate their respective domain
  and platform responsibilities.
- Disk writes should use the atomic write helpers in `src-tauri/src/storage.rs`.

### IPC Contract

- Rust structs and TypeScript interfaces crossing the Tauri IPC boundary must
  stay symmetric.
- Serialized fields are camelCase on the frontend-facing boundary. Examples:
  `filePaths`, `imagePath`, `byteSize`, `contentHash`, `mainWindowItemCount`,
  and `appearanceTheme`.
- When adding or changing a Tauri command or event, update both Rust
  `generate_handler!`/event emitters and frontend invoke/listen wrappers.
- Unknown or legacy persisted settings should load safely and normalize to
  defaults where possible.
- TypeScript must not use `any`; prefer explicit interfaces, unions, or
  `unknown` with narrowing.

## Window Model

There are seven runtime window labels. Only `main` is eagerly configured in
`tauri.conf.json`. Six auxiliary descriptors are created on demand after ready
generation coordination; the preview family warms after tray readiness.

- `main`: fixed-width tray window, not user-resizable.
- `preview`: independent transparent preview window for item detail or archive
  group list.
- `preview-detail`: independent detail window shown while hovering a group item.
- `image-viewer`: focusable, resizable image detail, opens maximized and restores
  to 720×520; supports pin/delete and Escape. Main stays visible beneath it and
  recovers its previous layering/dismissal behavior on close.
- `about`: fixed-size About window.
- `quick-action`: focusable 560×420 transformation result window, with copy and
  confirmed replacement actions.
- `preferences`: fixed-size Preferences window.

About, Preferences, image viewer, and quick actions are created on first use and
retained after hide. Payload/show callers must wait for the frontend listener-ready
handshake; do not restore eager startup WebViews for auxiliary windows.

Preview windows must remain independent Tauri windows:

- Do not put preview/detail UI back into the main DOM.
- Do not widen the main window to accommodate preview content.
- Keep preview and `preview-detail` non-focusable so they do not steal focus and
  trigger main-window dismissal.
- Keep Rust-side pointer hit testing for the preview window family.
- Preserve the no-gap interaction between main and preview windows unless the
  full hover path is retested.
- Keep request revisions, selection dismissal, and native pointer hit testing so
  late async responses cannot reopen a dismissed preview. Group measurement may
  change height/Y but must preserve X; independent detail placement uses the group
  monitor's scale factor and physical coordinates.

About and Preferences use custom dialog chrome. Only the shared status/title bar
with `[data-dialog-drag-region]` should start dragging; content areas should not
be draggable.

## Clipboard And History Rules

- Windows clipboard watching uses `AddClipboardFormatListener`.
- macOS watches `NSPasteboard.changeCount` every 500ms and only reads the full
  clipboard after the count changes.
- Linux polls every 500ms through a long-lived serialized `arboard` broker. Skipping
  full payload work through signature-first polling remains an open task; do not
  infer it is implemented from the presence of a change-token helper on macOS.
- File-list data takes precedence over image-like clipboard data.
- `file://` URL text should convert to file history when file history is
  enabled.
- Copying a file history item back must write system file-list clipboard data.
- Single common image files may be stored as image history for thumbnail and
  image restore behavior.
- Images are resized/encoded as PNG and stored under `history-assets/images/`.
- Text history filters empty or whitespace-only content.
- Main and archive list rows may ellipsize long filenames, but detail views must
  show full absolute paths and full filenames.

## UI And Design Conventions

- The app is a desktop utility. Keep UI compact, readable, scan-friendly, and
  operational rather than marketing-like.
- Prefer restrained surfaces, clear contrast, predictable controls, and stable
  layout dimensions.
- All seven windows share coherent light/dark/system theming and resolved language.
- Use native-feeling controls for preferences: selects for option sets, toggles
  for binary values, steppers or numeric inputs for bounded counts.
- Avoid decorative hero sections, nested cards, one-hue palettes, and UI text
  that explains obvious mechanics.
- Text must fit its container on desktop and small windows.
- On macOS, the light menu bar icon style must use native template-image
  rendering so the system can adapt to menu bar contrast.

## CLI And Install Rules

- `mclip-cli` is the terminal and AI Agent entrypoint.
- The Cargo package contains both `mclip` and `mclip-cli`; keep
  `default-run = "mclip"` in `src-tauri/Cargo.toml`.
- CLI help/version and transform help/execution must not read a history file.
- `agent` outputs an Agent-ready bundle with recent history, command capability
  information, and safety boundaries.
- `agent`, `list`, `get`, `search`, and `context` mask classified sensitive text by
  default; explicit `--raw`/`--reveal-secrets` affects only that invocation. Agent schema is 2.
- `add`, `copy`, `delete`, `pin`, `unpin`, and `clear --yes` are explicit mutating
  commands. `--pinned` filters read output; `clear --yes --keep-pinned` preserves pins.
- `add` writes to history without replacing the current system clipboard.
- `copy --index|--id` writes a selected history item back. `copy --stdin` or implicit
  piped input writes the clipboard without directly modifying history. Stdin/transform
  input is capped at 1 MiB and transform output at 4 MiB.
- CLI install defaults to a user-level bin directory and must not require
  `sudo` by default.
- `install.sh` and `site/public/install.sh` must stay byte-for-byte identical.
- Public install should prefer GitHub Release prebuilt binaries and only fall
  back to local/source builds when prebuilt binaries are unavailable.
- Public installation defaults to the latest public Release, with `MCLIP_VERSION`
  as an override. Preferences installation requires an exact desktop-version match.
  Both verify `.sha256` companions before replacing existing CLI binaries; desktop
  install is recoverable and must not automatically downgrade a newer CLI.

## Testing And Verification

Use repository-native checks before claiming a change is complete.

Common commands:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check:frontend
node --test tests/*.test.mjs
pnpm run cli:test
pnpm run site:build
pnpm --dir site run test
pnpm run check
pnpm run tauri:build
git diff --check
```

`pnpm run check` is the full local gate. It runs:

- `tsc && vite build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

For CLI changes, run `pnpm run cli:test`. For website/content changes, run
`pnpm --dir site run test` and usually `pnpm run site:build`. For formatting
or whitespace-sensitive changes, run `git diff --check`.

On macOS, check Windows source compatibility using LLVM, the Rust Windows target,
and cargo-xwin's Microsoft SDK/UCRT integration:

```bash
XWIN_ARCH=x86_64 cargo xwin check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets
```

The 2026-09-05 ignored-app verification records a successful run. Plain
`cargo check --target` does not activate that SDK automatically. Cross-compilation
and Windows CI still do not prove chooser, clipboard, focus, DPI, or installer
behavior on a Windows device. X11/XWayland and each supported Wayland compositor
likewise require separate native sessions.

## GitHub Actions And Release

- CI runs on `macos-latest`, `windows-2022`, and `ubuntu-24.04`.
- CI uses Node 24, pnpm 10.33.0, Rust stable with rustfmt, `pnpm install --frozen-lockfile`, `pnpm run check`, and `node --test tests/*.test.mjs`; Linux also builds `.deb`/AppImage packages.
- Release is triggered by `v*` tags.
- Release validates the tag against root/site package versions, Cargo manifest/lock,
  and built CLI output. Keep the frontend fallback version in `src/constants.ts`
  aligned as well. The pnpm workspace lock contains dependencies, not the app's own version.
- Tauri package version follows `src-tauri/tauri.conf.json` `"version":
  "../package.json"`.
- Release artifacts are created as draft GitHub Releases.
- Release notes must continue to disclose macOS notarization and Windows signing
  limits.
- `release.yml` also prepares stable `mclip-cli` release asset names used by
  the public installer for macOS ARM64, Windows x64, and Linux x64, each with a
  `.sha256` companion. Local runner checksum verification is implemented; a fresh
  same-Draft cross-platform download/checksum/version check is a release gate.
- `prepare-v0-2-0-release` requires prerequisite implementation/evidence completion
  or an explicit scoped waiver before version changes. Tag pushes, Draft publication,
  and asset replacement require explicit release-owner authorization.

## Platform Notes

### macOS

- `Info.plist` keeps `LSUIElement=true` so the app behaves as a menu bar tool
  rather than a Dock app.
- Runtime AppKit handling keeps the app accessory-style and hides Dock presence.
- Current macOS builds use ad-hoc signing and are not notarized.
- Users may need to remove quarantine from downloaded releases with:
  `xattr -dr com.apple.quarantine /Applications/mclip.app`.
- Auto paste requires Accessibility permission. Installed releases and
  `pnpm run tauri:dev` are separate macOS authorization identities.
- The menu bar icon uses a stable autosave name so macOS can restore a user-moved
  status item position; do not claim the app can force the rightmost position.

### Windows

- Release builds hide the console window.
- Clipboard listening uses a message-only window and Win32 clipboard events.
- Launch-at-login is implemented through the Startup folder `.cmd` path.
- Source-app detection uses foreground-window and process APIs.
- The installer can silently download WebView2 through the configured
  bootstrapper when needed.
- Windows installers are currently unsigned and may trigger SmartScreen.
- Tray ordering is controlled by Windows/Explorer and user settings, not by app
  code.

### Linux Preview

- Linux x86_64 `.deb`/AppImage and CLI assets are configured in CI/Release.
- A long-lived in-process clipboard broker owns desktop access. Short-lived CLI
  writes use a bounded two-second ownership handoff, still requiring paste-after-exit smoke.
- Clipboard, writes, tray, shortcut, source identity, autostart, and auto paste
  are separate capability states. Pure Wayland source identity is unavailable.
- The backend-only official autostart plugin manages user XDG startup entries;
  no root write, systemd service, external clipboard executable, or second daemon.
- Native X11/XWayland and compositor-specific Wayland evidence remains open;
  see [Linux support](../docs/linux-support.md) and its active change.

## Security And Permissions

- Keep Tauri capabilities minimal.
- Both capabilities cover `main`, `preview`, `preview-detail`, `image-viewer`,
  `about`, `quick-action`, and `preferences`; desktop positioning includes Linux.
- Current permissions include `core:default`, window hiding/dragging where
  needed, and `positioner:default`.
- When adding an eager window, update `tauri.conf.json`; for an auxiliary window,
  update descriptors and ready plumbing. In both cases update capabilities,
  `src/windowRoutes.ts`, symmetric types, and project docs.
- When adding a new Tauri API, check whether capabilities need new permissions.
- CSP allows app assets, image previews, Tauri IPC, and GitHub release checks;
  do not broaden it casually.
- Never upload clipboard history or content as part of normal app behavior.
- Native ignored-app picker/metadata commands are Preferences-only, return bounded
  identity/display data, and do not expose general-purpose frontend file reading.
- Diagnostics/performance records must omit clipboard text, queries, private paths,
  source names/IDs, and image bytes. Performance mode is opt-in and local.

## Development Practices

- Favor small, scoped changes that preserve existing architecture.
- Keep Rust responsible for native/system integration, persistence, performance,
  and safety-sensitive behavior.
- Keep React responsible for rendering, interaction, and view state.
- Keep business logic testable by extracting pure helpers or hooks.
- Treat settings changes as cross-boundary changes: update defaults,
  sanitization, frontend normalization, UI, i18n, and tests together.
- Treat preview behavior as sensitive. Cross-window hover, dismissal, focus, and
  pointer-hit paths need focused regression checks.
- Treat file clipboard behavior as high-risk. Verify file-list read/write
  semantics instead of relying on displayed path text.
- Prefer defensive handling for permissions, timeouts, corrupted local files,
  legacy settings/history, and platform API failures.
- Comments should explain non-obvious reasons, not restate obvious code.

## OpenSpec Guidance

- Use `openspec list --json` for task status and `openspec status --change <name>
  --json` plus that change's artifacts for specific work. `config.yaml` supplies
  concise project context and artifact rules; this file supplies the expanded map.
- Main specs are the synchronized baseline. Consult active deltas and verification
  records for implemented changes that are not yet synchronized or archived.
- Historical plans and completed validation entries retain their original commands
  and dates. New execution uses the current pnpm/cargo-xwin guidance; an old unchecked
  native task stays open until its exact evidence exists or a scoped waiver is recorded.
- A change should include `proposal.md`, `design.md`, `specs/.../spec.md`, and
  `tasks.md` when behavior or architecture is affected.
- Proposals should include what changes, why, impact, non-goals, and open
  questions when relevant.
- Designs should spell out Rust/TS contract changes, UI/window effects, platform
  behavior, and verification strategy.
- Specs should be written as user-observable requirements with concrete
  scenarios.
- Tasks should be checkable and should include tests, docs, and verification.
- Use `openspec validate <change>` before applying or archiving a change.
- Archive only after tasks are complete and the current implementation has been
  freshly verified.
