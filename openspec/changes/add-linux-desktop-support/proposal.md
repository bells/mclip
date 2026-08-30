## Why

mclip currently presents itself as a macOS and Windows clipboard tool, while the existing non-macOS/non-Windows polling path is neither built nor verified as a supported Linux product. v0.2.0 should add an honest Linux desktop tier with explicit X11 and Wayland capability boundaries, native packages, and release evidence instead of depending on external clipboard commands or an unintegrated daemon.

## What Changes

- Add a supported Linux desktop runtime for the existing tray-first Tauri application, preserving text, image, and file-list history, search, previews, shortcuts, settings, and local-only storage where the desktop environment exposes the required capabilities.
- Enable `arboard`'s maintained Wayland data-control backend while retaining its X11/XWayland backend; do not require `wl-copy`, `xclip`, or `xsel` executables at runtime.
- Detect and report clipboard, global-shortcut, tray, source-application, and launch-at-login capability degradation instead of claiming uniform support across all Wayland compositors.
- Use the graphical application process as the clipboard owner/watcher and use XDG autostart for launch at login; do not introduce a second `mclip-daemon` or install a systemd user service.
- Add Linux CI/build dependencies, Linux x86_64 desktop bundles, a checksum-verified `mclip-cli-linux-x64` asset, installer detection, and an asset-completeness gate.
- Require real X11 and Wayland desktop smoke evidence before Linux is described as supported; cross-compilation or unit tests alone are insufficient.
- Defer AUR publication and Linux ARM64 prebuilt assets until a maintained packaging path and native runner/device evidence exist.

## Capabilities

### New Capabilities

- `linux-desktop-runtime`: Linux clipboard, tray, window, shortcut, autostart, and capability-degradation behavior across X11/XWayland and supported Wayland compositors.
- `linux-distribution`: Linux desktop bundle production, CI coverage, release assets, checksums, and platform-specific validation evidence.

### Modified Capabilities

- `cli-distribution`: Extend the prebuilt CLI installer and Release asset contract to supported Linux x86_64 hosts without weakening checksum, rollback, or version-match guarantees.

## Impact

- Rust platform seams in `clipboard.rs`, `source_app.rs`, `settings.rs`, `window.rs`, and `lib.rs`; `arboard` feature configuration and any Linux-only Tauri/autostart dependencies.
- Tauri bundle configuration, Linux icons/metadata, capabilities, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `install.sh`, and `site/public/install.sh`.
- Frontend Preferences/i18n surfaces that expose unavailable desktop capabilities and actionable diagnostics.
- Linux system libraries for WebKitGTK, GTK, AppIndicator/tray integration, and packaging; no external clipboard executable dependency.
