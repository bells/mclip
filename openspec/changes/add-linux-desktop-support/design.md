## Context

mclip is one Tauri 2 package with a React frontend, a Rust desktop binary, and `mclip-cli`; it does not currently have the `mclip-core`, desktop, and daemon processes shown in the source proposal. The desktop has a single eager `main` window, six lazy auxiliary windows, a tray/global-shortcut entrypoint, revisioned local history, and platform-specific clipboard watchers. Linux currently falls into a generic 500 ms snapshot-polling branch, but CI and Release only cover macOS and Windows.

`arboard` resolves to 3.6.1. Its default Linux backend is X11/XWayland. Its optional `wayland-data-control` feature prioritizes `ext-data-control-v1`/`wlr-data-control-unstable-v1`, then falls back to X11; these compositor protocols are not D-Bus and are not universal. The same upstream backend supports text, PNG image data, and URI file lists, so external `wl-clipboard`, `xclip`, and `xsel` processes would add packaging and failure modes without filling the unsupported-compositor gap. Linux clipboard ownership also differs from macOS/Windows: the process setting a selection must remain able to serve it.

## Goals / Non-Goals

**Goals:**

- Make Linux x86_64 an evidence-backed desktop and CLI distribution tier.
- Preserve existing history, independent preview windows, typed IPC, local storage, and user-level installation behavior.
- Support X11/XWayland and data-control-capable Wayland without external clipboard executables.
- Expose actionable capability status when a desktop environment blocks clipboard, shortcut, tray, source-app, or autostart behavior.
- Keep clipboard ownership alive after desktop or CLI writes for the period required by Linux selection semantics.

**Non-Goals:**

- A second daemon, systemd user service, Flatpak/Snap sandbox policy, cloud synchronization, or a new crate split.
- A promise that every Wayland compositor supports history monitoring, global shortcuts, or foreground-app identity.
- AUR publication, Linux ARM64 prebuilt assets, or unsupported desktop-environment claims in v0.2.0.
- Replacing proven macOS/Windows native watchers or treating Linux CI as their runtime verification.

## Decisions

### 1. Extend the existing package through platform adapters

Keep `history.rs`, `desktop_state.rs`, and `agent_cli.rs` as shared domain seams. Introduce narrow clipboard, capability, source-app, and launch-at-login adapters under the existing modules rather than inventing `mclip-core`/`mclip-daemon` packages. Rust remains responsible for native capability and I/O; React receives serializable camelCase status DTOs.

Alternative considered: split three crates and add a daemon. Rejected because it would duplicate process lifecycle, storage ownership, single-instance behavior, and clipboard observation while providing no advantage for a tray application that already stays alive.

### 2. Use `arboard` X11 plus Wayland data-control

Enable `arboard = { version = "3.4.1", features = ["wayland-data-control"] }`; the lockfile-resolved implementation remains the reviewed maintained backend. On Wayland, let the library try data-control first and fall back to X11/XWayland. Failures become stable capability codes, not silent empty-history behavior. Do not shell out to `wl-copy`, `wl-paste`, `xclip`, or `xsel`.

Alternative considered: command-line clipboard tools. Rejected because they are extra runtime dependencies, do not solve compositor protocol support, complicate binary provenance, and weaken consistent image/file semantics.

### 3. Add a Linux clipboard broker with long-lived ownership

The current helper constructs short-lived `arboard::Clipboard` values. Add a Linux-only broker owned for the application lifetime and accessed through a bounded request channel from the watcher and write commands. The broker serializes reads/writes, polls the Clipboard selection at the existing interval, and retains the backend after a write so X11/Wayland consumers can request its data. CLI writes use the Linux `SetExtLinux` wait/ownership mechanism with a bounded handoff policy and clear error behavior rather than exiting immediately and losing content.

The initial Linux watcher remains change-signature polling because data-control does not provide one portable event model across all target desktops. It reads full content only after the signature changes and keeps the existing files-before-image-before-text priority.

Alternative considered: separate listener processes. Rejected because they create orphaning, service installation, and concurrent history-writer problems.

### 4. Represent platform support as capabilities

Add a typed `DesktopCapabilities` response with status values `available`, `degraded`, or `unavailable` and stable reason codes for clipboard history, clipboard write, global shortcut, tray activation, source-app detection, and launch at login. Preferences displays localized status and remediation. Logs may contain capability/reason codes and desktop-session metadata such as X11 versus Wayland, but not clipboard content, source-app names, or paths.

Pure Wayland without data-control is `unavailable` for clipboard monitoring unless XWayland is usable. Foreground-app identity is `unavailable` on pure Wayland in v0.2.0; ignored-app privacy rules must honor that limitation rather than assuming success.

### 5. Preserve the tray-first window model and validate desktop differences

Reuse Tauri tray events and the existing non-macOS anchor path, then test monitor work areas, panels on all edges, mixed scaling, and transparent non-focusable preview behavior on Linux. Linux-specific fixes stay in the window adapter. No auxiliary window becomes eager and preview windows remain non-focusable.

Global shortcut registration failures do not prevent tray/manual use; they surface as degraded capability status. Tray absence or unsupported status notifier implementations must produce a diagnosable fallback instead of leaving an invisible process with no user entrypoint.

### 6. Use XDG autostart, not systemd

Implement Linux `launchAtLogin` through the official Tauri autostart plugin or its XDG `.desktop` contract behind the existing settings adapter, installed in the user configuration directory with no `sudo`. Keep current macOS LaunchAgent and Windows Startup behavior unchanged during this change. Settings remain immediate-apply/immediate-save and report write/permission errors.

Alternative considered: `~/.config/systemd/user/mclip.service`. Rejected because mclip is a graphical tray application tied to a desktop session and Wayland/X11 environment, not a headless system service.

### 7. Add Linux x86_64 CI and release assets in stages

Add an Ubuntu x86_64 job with pinned GTK/WebKitGTK/AppIndicator build prerequisites, `npm run check`, root Node tests, site gates when public copy changes, and a Tauri bundle build. Release produces Linux desktop artifacts supported by the verified runner (at minimum `.deb` and `.AppImage`) plus `mclip-cli-linux-x64` and `.sha256`. The completeness job checks the exact advertised matrix from the same Draft Release.

`install.sh` and `site/public/install.sh` add `Linux:x86_64|amd64` mapping while preserving exact-version download, checksum fail-closed behavior, user-level atomic replacement, rollback, and source fallback. Linux ARM64 returns a clear unsupported-prebuilt path until a native runner and Release asset exist.

## Risks / Trade-offs

- [Wayland data-control is not universal] → Detect backend failure, expose capability status, verify representative GNOME/KDE/wlroots sessions, and document XWayland fallback without claiming universal support.
- [Linux selection content can disappear after the writer exits] → Use a long-lived desktop broker and a bounded CLI ownership handoff; add real paste-after-write smoke tests.
- [Tray/global-shortcut support varies by shell and portal] → Treat each as an independent capability and require a visible fallback/remediation path.
- [Ubuntu CI can build packages without proving a real desktop] → Separate compile/package gates from X11 and Wayland native smoke evidence.
- [Adding Linux expands the Release asset matrix] → Generate a manifest-like expected list and fail Draft completeness checks when any binary/checksum is missing.
- [New build dependencies can drift with runner images] → Pin documented package names and keep the Linux job independent so macOS/Windows results stay visible.

## Migration Plan

1. Add capability DTOs and Linux-only backend tests without advertising Linux support.
2. Enable the `arboard` feature and broker, then verify text/image/files read/write on native X11 and supported Wayland.
3. Add tray/window/shortcut/autostart handling and desktop smoke protocols.
4. Add Linux CI, bundles, CLI asset, installer mapping, and Draft completeness checks.
5. Enable Linux claims only after the v0.2.0 release-readiness change records the required evidence.

Rollback removes Linux from the advertised/expected asset matrix and installer prebuilt mapping while leaving macOS/Windows artifacts intact. Existing Linux local history/settings remain ordinary JSON and require no destructive migration.

## Open Questions

- Which named Wayland compositor/version pairs will constitute the v0.2.0 supported evidence matrix?
- Does the selected Ubuntu Tauri runner reliably produce both `.deb` and `.AppImage`, or must the advertised minimum be reduced to the artifact set observed in the Draft?
- Which tray fallback is acceptable when a desktop lacks StatusNotifier/AppIndicator support: a decorated taskbar window or an explicit unsupported-session error?
