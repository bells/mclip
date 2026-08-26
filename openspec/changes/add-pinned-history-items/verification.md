## Packaged Verification

### macOS packaged smoke — 2026-08-26

Artifact: `src-tauri/target/release/bundle/macos/mclip.app`

The packaged application was launched with `MCLIP_PERF_MODE=1` and a temporary config directory containing synthetic text, image, and file history. No mutation was performed against the user's normal mclip config directory.

Verified:

- A mixed pinned/unpinned main list renders one 2 px boundary divider without `Pinned`/`Recent` text or per-row pin markers.
- Pins remain above 10 configured unpinned rows and do not change the `11 - 20` archive range.
- The detail title bar renders the pin action in its active state for a pinned entry.
- Packaged `mclip-cli` pin, unpin, and repeated add preserve one stable ID, increment `copyCount`, preserve pin metadata during dedupe, and clear `pinnedAt` on unpin.
- GUI search reduced the synthetic list to the one matching entry and restored the full list after clearing the query.
- GUI archive navigation opened the `11 - 20` independent preview family.
- GUI `Clear, Keep Pinned` reduced 25 synthetic entries to the one pinned entry.
- The packaged app and DMG were rebuilt after the smoke-discovered add-result and archive-local-numbering fixes.

Open macOS boundary:

- The independent item-detail window intentionally remains `focusable(false)`. Computer Use could inspect its rendered active pin button but could not dispatch a direct click to that non-focusable window. One manual packaged-app click-through of pin then unpin is still required before task 6.3 can be marked complete.

### Windows native boundary

No Windows artifact or Windows device was available in this macOS run. Rust/TypeScript contracts and cross-platform automated tests passed, but they do not establish tray, WebView, clipboard, window focus, or pointer behavior on Windows.

### Linux native boundary

Linux desktop support is scoped to the separate `add-linux-desktop-support` change. This pin change keeps portable history/CLI contracts, but no Linux packaged runtime claim is made here.
