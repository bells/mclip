# Linux desktop support

This document defines the maintainer contract for the Linux desktop tier. It is
an implementation and verification guide, not a claim that every Linux desktop
session is supported.

## Build target and prerequisites

- Architecture: `x86_64-unknown-linux-gnu` on Ubuntu 24.04.
- Node.js: 24, installed through `actions/setup-node`.
- Rust: stable with `rustfmt`.
- Native packages: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`,
  `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, and `libfuse2`.
- Planned desktop bundles: Debian package (`.deb`) and AppImage.
- Planned CLI assets: `mclip-cli-linux-x64` and
  `mclip-cli-linux-x64.sha256`.

CI proves source compatibility and package production only. It does not prove
clipboard ownership, tray activation, global shortcuts, transparent window
behavior, panel anchoring, or launch-at-login in a real desktop session.

## Session capability tiers

| Session | Clipboard | Source app identity | Notes |
| --- | --- | --- | --- |
| X11 | In-process `arboard` X11 backend | Best-effort `WM_CLASS` | Native smoke required |
| XWayland | Wayland data-control first, X11 fallback | Best-effort X11 identity | A fallback is reported as degraded |
| Pure Wayland with data-control | In-process `arboard` data-control backend | Unavailable | Compositor-specific smoke required |
| Pure Wayland without data-control | Unavailable | Unavailable | Never reported as successful monitoring |

Clipboard, clipboard writes, tray activation, global shortcut, source-app
identity, launch at login, and auto paste are reported independently. A failure
in one capability must not make another capability appear unavailable.

The runtime must not invoke `wl-copy`, `wl-paste`, `xclip`, or `xsel`. Linux
clipboard access stays inside the graphical mclip process. The process owns one
bounded, serialized clipboard broker so desktop writes remain serviceable under
Linux selection ownership rules. Short-lived CLI writes use arboard's bounded
two-second ownership handoff; a real-session paste-after-exit smoke remains
required because clipboard-manager behavior differs between desktops.

## Launch at login

Linux uses the official Tauri autostart plugin as a backend-only adapter. It
writes the user-scoped XDG autostart `.desktop` entry used by the graphical
session. Preferences continues to call mclip's typed `save_settings` command;
it does not call plugin commands directly and therefore does not receive
autostart or shell permissions. A failed enable/disable operation aborts the
settings write, so the immediate-save UI rolls back instead of persisting a
false value.

No systemd user service, root write, shell profile edit, or second history
writer is installed.

## Native smoke protocol

For every supported row, record the distribution, desktop environment,
compositor, display protocol, package format, and architecture. Install the
release-mode package and verify each item independently:

1. Text, PNG image, and URI file-list capture and restoration.
2. Clipboard content remains pasteable after desktop and CLI writes.
3. Tray show/hide and `CommandOrControl+Shift+V`, including the degraded path.
4. Main-window anchoring for top, bottom, left, and right panels on the clicked
   monitor, including negative coordinates and mixed scaling.
5. Fixed-width main window, lazy auxiliary windows, and non-focusable
   `preview`/`preview-detail` behavior.
6. Search, copy, auto paste, delete, clear, image viewer, About, and the current
   Preferences Settings Center.
7. XDG launch-at-login enable, relaunch, disable, and write-failure rollback.

Unverified or failed cells remain unavailable/degraded. Results from X11,
XWayland, or one Wayland compositor must not be generalized to another.

## v0.2.0 exclusions

- Linux ARM64 prebuilt desktop or CLI assets.
- AUR, Flatpak, Snap, RPM, or distro-repository publication.
- External clipboard executables.
- A background daemon or systemd user service.
- Universal Wayland, portal, tray, shortcut, or source-identity claims.
