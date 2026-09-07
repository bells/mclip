# Product

## Register

product

## Users

mclip is for people who copy text, screenshots, and files during normal desktop work and need to recover or reuse recent clipboard items without switching into a full application. They are usually in the middle of another task, so the UI must open quickly, scan quickly, and get out of the way.

## Product Purpose

mclip is a tray-first clipboard history tool for macOS and Windows, with a Linux x86_64 preview implementation pending native desktop verification. It keeps local clipboard history for text, images, and files, deduplicates repeated content, and lets users search, preview, copy, delete, and configure history behavior from compact desktop windows. File history should restore files as files rather than as path-only text. Success means the user can restore the right clipboard item with minimal reading and minimal interruption.

## Current Source Baseline

Reviewed on 2026-09-06. The source manifests still declare `0.1.1`; the working tree also includes features tracked toward `0.2.0`. The following describes implemented source behavior, not the contents of a freshly verified published release. Release readiness and native evidence are tracked in [OpenSpec](openspec/README.md).

当前源码版本仍为 `0.1.1`，已包含面向 `0.2.0` 的功能。本文描述源码现状；安装包、发布资产与各平台原生体验是否通过验收，应以对应验证记录为准。

The desktop shell provides:

- System, light, and dark appearance across every Tauri window.
- New installs retain 200 ordinary history items by default, configurable from 10–500. Main-list count defaults to 10 and accepts 5 through the ordinary history limit; archive-group count defaults to 50 and accepts 5–100. Row numbers and main-window branding are configurable.
- Up to 100 pinned items appear before ordinary history, ordered by most recent pin time. They do not consume ordinary retention or main/archive count limits; repeated copying preserves the pin time.
- A bounded main-window history scroller that keeps search and footer actions available.
- Compact text/file rows and taller image rows that preserve useful thumbnails in the main list and archive previews.
- Archive previews measured from rendered content, with a separate hover-detail window and one canonical active target shared by search, keyboard, and pointer input.
- A dedicated image viewer that opens maximized, restores to a 720×520 frame, and supports deletion and Escape-to-close.
- Consistent detail-owned deletion, color-code and emoji affordances, and complete file-path details.
- A startup tier that creates only `main` eagerly, warms the preview family, and creates About, Preferences, the image viewer, and quick actions on demand.
- Revisioned snapshot/delta history updates and a bounded 32 MiB single-flight image cache, reducing work in hidden windows without changing the local-only data boundary.
- A local `mclip-cli` Agent Mode plus version-aware, SHA-256-verified, recoverable desktop and public installation.
- A searchable Preferences Settings Center with Behavior, Appearance, History, Privacy, Text Actions, and Agent CLI destinations. Language, theme, tray icon, branding and row numbers live in Appearance; History contains save types, retention limits and main/group display counts. Controls save immediately, serialize pending changes, and show failures with rollback.
- Local sensitive-text classification and fixed display masking, explicit reveal/copy of originals, and capture exclusion by stable source identity. Ignored applications are managed with a native picker and removable list; pure Wayland source exclusion remains unavailable. Masking is not encryption at rest.
- Bounded JSON, Base64, and URL-component transformations in an independent quick-action window and CLI pipelines. Desktop results stay in memory until explicitly copied or confirmed for replacement; CLI transforms emit their result for pipeline use.
- Chinese, English, and Japanese desktop and website copy. Follow System resolves Chinese and Japanese locales accordingly, and otherwise falls back to English; CLI commands/help/output remain English-first.
- Compact footer actions with visible platform-specific shortcut keycaps; clearing history still requires confirmation. The native tray context menu also opens Preferences.
- Text detail actions use compact JSON / Base64 / URL-component rows; result windows prioritize Copy and confirm Replace. Light/dark/system settings update open windows.

The recorded [v0.1.1 performance protocol](performance/final-v0.1.1-runtime-performance.md) on an Apple M2 macOS release build measured tray-ready median improving from 449.12 ms to 218.51 ms (51.3%) and repeated image-viewer shell median improving from 384.62 ms to 49.37 ms (87.2%). These are historical macOS measurements, not benchmarks of every later commit. Windows artifact/device benchmarks and complete native smoke remain separate evidence requirements.

The app has no accounts, cloud sync, remote clipboard storage, or uploaded usage telemetry. Diagnostics and opt-in performance measurements are local. Manual update checks and explicit CLI installation may contact GitHub; local-first does not mean the application never uses the network.

## Platform And Delivery Boundaries

- macOS uses ad-hoc signing and is not notarized; Windows installers are unsigned and may need the WebView2 bootstrapper.
- Linux CI and Release workflows configure `.deb`/AppImage packages and an x64 CLI asset. Source/build configuration does not prove successful installation, clipboard ownership, tray positioning, or compositor behavior. See [Linux support](docs/linux-support.md).
- Linux capabilities are reported independently as available, degraded, or unavailable. X11/XWayland and each named Wayland compositor require their own native evidence; Linux signature-first polling remains an open implementation task.
- Version synchronization, migration/downgrade tests, native packaged smoke, and same-Draft asset verification remain part of the `prepare-v0-2-0-release` gate. A completed implementation checklist or strict OpenSpec validation does not establish release completion.

## Brand Personality

Quiet, precise, local-first. The interface should feel like a focused desktop utility: dense enough for repeated use, calm enough for everyday background work, and trustworthy with private clipboard data.

## Anti-references

This should not look like a marketing page, a permanent large-window productivity suite, a decorative glass panel, or a theme experiment. Avoid ornamental effects that compete with the clipboard content, oversized typography, loud color fields, vague empty states, and any preview behavior that makes the main window feel wider or less predictable.

## Design Principles

1. Preserve task focus: content, search, preview, and copy actions take priority over decoration.
2. Keep the tray-tool footprint: windows stay compact, predictable, and fast to dismiss.
3. Separate preview intent: group previews and item detail previews are different surfaces, even when they share renderers.
4. Make state visible: selection, hover, focus, disabled, errors, and saving states must be readable without relying on motion alone.
5. Respect local trust: copy, diagnostics, and settings language should be specific about local behavior and avoid remote-service assumptions.
6. Keep configuration reversible: display counts, theme, row numbers, and branding change presentation without changing stored clipboard content.
7. Treat platform parity as a release requirement: macOS and Windows should expose the same core workflows even when their native implementations differ. Advertise Linux workflows only to the level supported by recorded session evidence.

## Interaction Model

- The main window is a fixed-width, tray-anchored utility surface.
- Search and footer actions remain fixed; only history and archive navigation scroll.
- `preview` owns either one item detail or an archive list. In archive mode, `preview-detail` owns the active row’s independent detail.
- Preview windows stay non-focusable and use native pointer hit testing so moving between related windows does not dismiss them.
- `image-viewer` is a focusable, resizable detail surface. It opens maximized while the main window remains visible below it, then restores the main window’s previous layering and dismissal behavior when closed.
- About and Preferences are separate fixed-size dialogs with an explicit title-bar drag region.
- `quick-action` is a separate, focusable 560×420 result window with copy and confirmed replacement actions.
- Theme and language apply consistently to all seven window labels: `main`, `preview`, `preview-detail`, `image-viewer`, `about`, `quick-action`, and `preferences`.

## Accessibility & Inclusion

Target practical WCAG AA readability for text and controls. Preserve keyboard workflows for search, selection, confirmation, settings, and dismissal. Keep focus states visible, support reduced motion, avoid color-only state communication, and keep Chinese, English, and Japanese UI copy aligned.
