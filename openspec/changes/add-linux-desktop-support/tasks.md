## 1. Linux Baseline and Dependency Decisions

- [x] 1.1 Record the supported Linux x86_64 build prerequisites, target sessions, planned package formats, and explicit v0.2.0 exclusions in maintainer documentation.
- [x] 1.2 Add contract tests that pin the Linux backend selection, capability status, external-command prohibition, and package/asset names before implementation.
- [x] 1.3 Enable the reviewed `arboard` Wayland data-control feature and update Cargo.lock without adding `wl-clipboard`, `xclip`, or `xsel` runtime dependencies.
- [x] 1.4 Evaluate the official Tauri autostart plugin against the existing settings contract and record the selected Linux-only XDG integration and permissions.

## 2. Linux Clipboard Runtime

- [x] 2.1 Extract platform-neutral clipboard snapshot/read/write interfaces while preserving files-before-image-before-text priority and macOS/Windows behavior.
- [x] 2.2 Implement a Linux-only long-lived clipboard broker with bounded requests, serialized `arboard` access, and clean shutdown.
- [x] 2.3 Implement X11 and Wayland-data-control initialization/fallback classification with stable capability reason codes.
- [ ] 2.4 Route Linux polling through signature-first reads so unchanged intervals do not process full clipboard payloads.
- [x] 2.5 Implement Linux text, PNG image, and URI file-list read/write parity through the broker.
- [x] 2.6 Implement Linux desktop clipboard ownership retention and CLI bounded ownership handoff.
- [x] 2.7 Add Rust tests for backend selection, polling, content priority, URI paths, broker errors, resource bounds, and ownership policy.

## 3. Desktop Capabilities and Session Integration

- [x] 3.1 Define symmetric Rust/TypeScript `DesktopCapabilities`, status, and reason-code contracts without `any`.
- [x] 3.2 Add a typed Tauri capability command and update `services/ipc`, the compatibility facade, command registration, and capability permissions.
- [x] 3.3 Implement Linux source-app capability reporting, with pure Wayland explicitly unavailable and supported X11 identity best-effort.
- [x] 3.4 Implement Linux XDG launch-at-login through the selected adapter with immediate-save rollback on failure and no systemd service.
- [x] 3.5 Integrate tray/global-shortcut startup failures as independent degraded capabilities while preserving a visible user entrypoint.
- [x] 3.6 Add bilingual Preferences status/remediation copy and retain immediate-apply/immediate-save behavior.

## 4. Linux Window and Interaction Parity

- [x] 4.1 Add Linux monitor/panel work-area tests for top, bottom, left, and right panels, negative coordinates, mixed scaling, and clicked-monitor selection.
- [x] 4.2 Adapt tray anchoring and main-window clamping only where Linux runtime evidence shows the generic path is insufficient.
- [x] 4.3 Verify the main window remains fixed-width/non-resizable and all six auxiliary windows remain lazy.
- [x] 4.4 Verify `preview` and `preview-detail` stay independent and non-focusable across pointer and keyboard transitions.
- [ ] 4.5 Verify clipboard selection, auto-paste capability, search, delete, clear, image viewer, About, and Preferences behavior on Linux.

## 5. Linux CI, Packaging, and CLI Installation

- [x] 5.1 Add an Ubuntu x86_64 CI job with pinned GTK/WebKitGTK/AppIndicator prerequisites, `npm run check`, and root Node contract tests.
- [x] 5.2 Configure and build the verified Linux desktop bundle formats, icons, categories, and package metadata.
- [x] 5.3 Add Linux x86_64 to the Release matrix and produce `mclip-cli-linux-x64` plus its `.sha256` after version verification.
- [x] 5.4 Extend the same-Draft completeness job with every advertised Linux desktop artifact and both Linux CLI assets.
- [x] 5.5 Add Linux x86_64 detection, checksum verification, rollback, and clear unsupported-architecture behavior to `install.sh`.
- [x] 5.6 Keep `site/public/install.sh` byte-identical and add installer tests for Linux x86_64, Linux ARM64, checksum failure, and source fallback.

## 6. Verification and Support Evidence

- [x] 6.1 Run `npm run check`, `node --test tests/*.test.mjs`, `npm run site:test`, `npm run site:build`, and `git diff --check` after implementation.
- [ ] 6.2 Install a release-mode Linux package and record X11/XWayland text, image, files, clipboard ownership, tray, shortcut, autostart, and multi-monitor smoke evidence.
- [ ] 6.3 Record the same protocol on each named supported Wayland compositor and retain unavailable/degraded cells without extrapolation.
- [ ] 6.4 Verify Linux CLI pipeline writes remain pasteable after command exit under the bounded ownership policy.
- [ ] 6.5 Update README, AGENTS, bilingual site/changelog, `llms.txt`, and Release limitations only to the level supported by recorded evidence.
- [x] 6.6 Run `openspec validate add-linux-desktop-support --type change --strict` and resolve every validation finding.
