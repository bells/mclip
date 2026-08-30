# Project Context

## Purpose

`mclip` is a local-first, tray-first clipboard history app for macOS and Windows.
It is designed as a compact desktop utility, not a full-size always-open window.
The core product promise is fast access to recent clipboard history, safe local
persistence, and reliable restore of text, images, and copied files.

The app should stay quiet and utilitarian: users open it from the menu bar,
system tray, or `CommandOrControl+Shift+V`, pick or search a history item, and
return to their current work with minimal interruption.

## Tech Stack

- Frontend: React 19, TypeScript, Vite.
- Desktop shell: Tauri 2.
- Backend: Rust 2021.
- CLI: Rust binary `mclip-cli` in the same Cargo package.
- Website: Astro static site under `site/`.
- CI and release: GitHub Actions, `tauri-apps/tauri-action`, Node 24, Rust stable.
- Core frontend dependencies: `@tauri-apps/api`, `@tauri-apps/plugin-positioner`,
  `react`, and `react-dom`.
- Core Rust dependencies: `tauri`, `serde`, `serde_json`, `arboard`, `image`,
  `sha2`, `base64`, `tauri-plugin-global-shortcut`,
  `tauri-plugin-single-instance`, `tauri-plugin-positioner`,
  `raw-window-handle`, and platform-specific macOS/Windows APIs.

## Product Model

- `mclip` runs from the macOS menu bar or Windows tray.
- The main window is compact, fixed-width, transparent, rounded, and hidden by
  default.
- Clipboard history supports text, images, and files.
- File history must be restored as a system file list, not as plain path text.
- History is local only. `history.json`, `settings.json`, and image assets live
  in the local app config directory.
- Duplicate clipboard content is deduplicated and moved back to the top.
- Main-window and archive-group visible item counts default to `10` and `50`
  respectively, and are user configurable.
- Preferences include launch at login, language, appearance theme, menu bar icon
  style, auto paste, max history count, visible counts, row number visibility,
  and enabled history types.
- The app supports Chinese, English, and Japanese UI; user-facing copy changes
  must update all three parity-checked catalogs. Follow System resolves `zh`
  locales to Chinese, `ja` locales to Japanese, and unsupported locales to
  English. CLI command names, help, and output remain English-first.
- The public website and `llms.txt` should stay aligned when public product,
  install, or CLI behavior changes.

## Architecture

### Frontend

- `src/App.tsx` routes by Tauri window label:
  `main`, `preview`, `preview-detail`, `about`, and `preferences`.
- `src/types.ts` contains the canonical TypeScript side of Rust/TS IPC payloads.
- Frontend Tauri calls are wrapped in `src/lib/tauri.ts` and service helpers
  under `src/services/`.
- Main app state is orchestrated by `src/hooks/useClipboardApp.ts`, with focused
  controllers for data, preview, and actions.
- Pure behavior should be extracted to `src/utils/` when it needs regression
  coverage or crosses UI component boundaries.
- UI components should remain focused: components render, hooks orchestrate
  state and effects, services talk to Tauri.

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

There are five configured Tauri windows:

- `main`: fixed-width tray window, not user-resizable.
- `preview`: independent transparent preview window for item detail or archive
  group list.
- `preview-detail`: independent detail window shown while hovering a group item.
- `about`: fixed-size About window.
- `preferences`: fixed-size Preferences window.

Preview windows must remain independent Tauri windows:

- Do not put preview/detail UI back into the main DOM.
- Do not widen the main window to accommodate preview content.
- Keep preview and `preview-detail` non-focusable so they do not steal focus and
  trigger main-window dismissal.
- Keep Rust-side pointer hit testing for the preview window family.
- Preserve the no-gap interaction between main and preview windows unless the
  full hover path is retested.

About and Preferences use custom dialog chrome. Only the shared status/title bar
with `[data-dialog-drag-region]` should start dragging; content areas should not
be draggable.

## Clipboard And History Rules

- Windows clipboard watching uses `AddClipboardFormatListener`.
- macOS watches `NSPasteboard.changeCount` every 500ms and only reads the full
  clipboard after the count changes.
- Other non-Windows platforms may fall back to polling.
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
- Main, preview, About, and Preferences should share coherent light/dark/system
  theming.
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
- CLI help/version commands must not require reading a history file.
- `agent` outputs an Agent-ready bundle with recent history, command capability
  information, and safety boundaries.
- `list`, `get`, `search`, and `context` are read-oriented commands.
- `add`, `copy`, `delete`, and `clear --yes` are explicit mutating commands.
- `add` writes to history without replacing the current system clipboard.
- `copy` writes a selected history item back to the system clipboard.
- CLI install defaults to a user-level bin directory and must not require
  `sudo` by default.
- `install.sh` and `site/public/install.sh` must stay byte-for-byte identical.
- Public install should prefer GitHub Release prebuilt binaries and only fall
  back to local/source builds when prebuilt binaries are unavailable.

## Testing And Verification

Use repository-native checks before claiming a change is complete.

Common commands:

```bash
npm ci
npm run check:frontend
node --test tests/*.test.mjs
npm run cli:test
npm run site:build
npm --prefix site run test
npm run check
npm run tauri:build
git diff --check
```

`npm run check` is the full local gate. It runs:

- `tsc && vite build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

For CLI changes, run `npm run cli:test`. For website/content changes, run
`npm --prefix site run test` and usually `npm run site:build`. For formatting
or whitespace-sensitive changes, run `git diff --check`.

macOS local checks cannot fully prove Windows runtime behavior. Windows-specific
changes need CI or a Windows machine for runtime confidence; at minimum keep the
code clippy-clean and confirm the `windows-2022` CI job when available.

## GitHub Actions And Release

- CI runs on `macos-latest` and `windows-2022`.
- CI uses Node 24, Rust stable with rustfmt, `npm ci`, and `npm run check`.
- Release is triggered by `v*` tags.
- Release validates that the tag version matches `package.json`.
- Tauri package version follows `src-tauri/tauri.conf.json` `"version":
  "../package.json"`.
- Release artifacts are created as draft GitHub Releases.
- Release notes must continue to disclose macOS notarization and Windows signing
  limits.
- `release.yml` also prepares stable `mclip-cli` release asset names used by
  the public installer.

## Platform Notes

### macOS

- `Info.plist` keeps `LSUIElement=true` so the app behaves as a menu bar tool
  rather than a Dock app.
- Runtime AppKit handling keeps the app accessory-style and hides Dock presence.
- Current macOS builds use ad-hoc signing and are not notarized.
- Users may need to remove quarantine from downloaded releases with:
  `xattr -dr com.apple.quarantine /Applications/mclip.app`.
- Auto paste requires Accessibility permission. Installed releases and
  `npm run tauri:dev` are separate macOS authorization identities.
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

## Security And Permissions

- Keep Tauri capabilities minimal.
- Current windows listed in capabilities are `main`, `preview`, `preview-detail`,
  `about`, and `preferences`.
- Current permissions include `core:default`, window hiding/dragging where
  needed, and `positioner:default`.
- When adding a window, update `tauri.conf.json`, capability files, `src/App.tsx`,
  and project docs.
- When adding a new Tauri API, check whether capabilities need new permissions.
- CSP allows app assets, image previews, Tauri IPC, and GitHub release checks;
  do not broaden it casually.
- Never upload clipboard history or content as part of normal app behavior.

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
