## Why

Frequently reused clipboard entries currently age out with ordinary history and are difficult to keep within reach. v0.2.0 needs a first-class pinned state that is persisted, consistently ordered, protected from automatic retention cleanup, and available through both the desktop UI and `mclip-cli`.

## What Changes

- Add backward-compatible pinned metadata to every text, image, and files history entry, with deterministic pinned and unpinned ordering.
- Add typed desktop commands/events and CLI commands to pin, unpin, toggle, and filter history entries by pinned state.
- Keep pinned entries above unpinned history in the main window, search results, archive navigation, preview payloads, and CLI output while preserving the current keyboard and independent-preview window model.
- Exclude pinned entries from automatic maximum-history trimming and image-resource cleanup; bound the number of pinned entries separately so local storage remains finite.
- Preserve pinned state when the same content is copied again and define explicit clear/delete behavior so destructive actions do not silently remove pinned entries.
- Migrate existing `history.json` entries as unpinned without rewriting the file solely for migration.

## Capabilities

### New Capabilities

- `pinned-history`: Persistent pin metadata, ordering, retention, mutation, filtering, and explicit destructive-action semantics shared by desktop and CLI.

### Modified Capabilities

- `history-display`: Display and navigate a stable pinned section ahead of chronological unpinned history without breaking search, archive grouping, row density, or preview behavior.

## Impact

- Rust/TypeScript `HistoryEntryCommon` contracts, serde migration defaults, desktop repository mutations, revisioned deltas, persistence, trimming, image cleanup, and CLI output schemas.
- Main history list, archive grouping, search/filter utilities, preview windows, keyboard navigation, delete/clear confirmation, Preferences/i18n, and focused contract tests.
- `mclip-cli` command parsing, Agent capability metadata, JSON/Markdown/text output, integration tests, and public CLI documentation.
