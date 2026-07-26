# Product

## Register

product

## Users

mclip is for people who copy text, screenshots, and files during normal desktop work and need to recover or reuse recent clipboard items without switching into a full application. They are usually in the middle of another task, so the UI must open quickly, scan quickly, and get out of the way.

## Product Purpose

mclip is a tray-first clipboard history tool for macOS and Windows. It keeps local clipboard history for text, images, and files, deduplicates repeated content, and lets users search, preview, copy, delete, and configure history behavior from compact desktop windows. File history should restore files as files rather than as path-only text. Success means the user can restore the right clipboard item with minimal reading and minimal interruption.

## Current Release

Version `0.1.1` is the first polished core release. It keeps the v0.1.0 clipboard model and focuses on a configurable, readable desktop shell:

- System, light, and dark appearance across every Tauri window.
- Configurable main-list and archive-group counts, row-number visibility, and main-window branding.
- A bounded main-window history scroller that keeps search and footer actions available.
- Compact archive previews measured from rendered content, with a separate hover-detail window.
- Consistent detail-owned deletion, color-code and emoji affordances, and complete file-path details.
- A local `mclip-cli` Agent Mode plus prebuilt-binary-first public installation.

The release does not add accounts, cloud sync, telemetry, or remote clipboard storage.

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
7. Treat platform parity as a release requirement: macOS and Windows should expose the same core workflows even when their native clipboard, startup, tray, and paste implementations differ.

## Interaction Model

- The main window is a fixed-width, tray-anchored utility surface.
- Search and footer actions remain fixed; only history and archive navigation scroll.
- `preview` owns either one item detail or an archive list. In archive mode, `preview-detail` owns the active row’s independent detail.
- Preview windows stay non-focusable and use native pointer hit testing so moving between related windows does not dismiss them.
- About and Preferences are separate fixed-size dialogs with an explicit title-bar drag region.
- Theme and language apply consistently to all five window labels: `main`, `preview`, `preview-detail`, `about`, and `preferences`.

## Accessibility & Inclusion

Target practical WCAG AA readability for text and controls. Preserve keyboard workflows for search, selection, confirmation, settings, and dismissal. Keep focus states visible, support reduced motion, avoid color-only state communication, and keep bilingual Chinese and English UI copy aligned.
