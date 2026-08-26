## Context

History entries are a tagged Rust enum with flattened `HistoryEntryCommon`, mirrored as a TypeScript union and stored directly in `history.json`. A single canonical vector is deduplicated, sorted newest-first, automatically trimmed to `maxHistoryCount`, delivered through revisioned mutations, and shared with `mclip-cli`. Image cleanup derives liveness from that vector. Main-window grouping currently assumes every entry occupies one chronological position.

Pinning therefore cannot be a frontend-only flag: persistence migration, deduplication, trim behavior, image resource retention, CLI path helpers, revision deltas, search/grouping, and destructive actions must agree on one ordering and retention policy.

## Goals / Non-Goals

**Goals:**

- Persist pin state for text, image, and file entries with backward-compatible serde defaults.
- Define one deterministic order and mutation contract for desktop, previews, search, and CLI.
- Protect pins from automatic retention cleanup while keeping storage bounded.
- Preserve current revisioned delta and lazy-window architecture.

**Non-Goals:**

- Multiple pin collections, drag-to-reorder, cross-device sync, tags, folders, or cloud storage.
- Inline pin controls in compact main/archive rows or a dedicated pin keyboard shortcut; both may be revisited separately.
- Making pins undeletable after an explicit delete/clear confirmation.
- Replacing the history file format or introducing a database in v0.2.0.

## Decisions

### 1. Store pin metadata in `HistoryEntryCommon`

Add camelCase `isPinned: bool` with `#[serde(default)]` and `pinnedAt: Option<u64>` with a default of `None`. The invariant is `isPinned == false` implies `pinnedAt == None`; sanitization repairs invalid persisted pairs. The TypeScript common contract mirrors both fields without `any`.

Alternative considered: a separate pins file keyed by history ID. Rejected because it creates transactional drift across dedupe, delete, clear, CLI writes, and image cleanup.

### 2. Keep one canonical ordered vector

Centralize ordering in a pure comparator used after load and every mutation:

1. pinned entries before unpinned entries;
2. pinned entries by `pinnedAt` descending, then `lastCopiedAt` descending, then stable ID;
3. unpinned entries by `lastCopiedAt` descending, then stable ID.

Re-copying duplicate content preserves its pin fields and updates the ordinary copy timestamps/count, but it does not change `pinnedAt`. Toggling from unpinned to pinned assigns the mutation timestamp; toggling off clears it.

Alternative considered: a separate pinned vector. Rejected because every filter, snapshot, delta, and CLI index would need reconciliation.

### 3. Bound pins separately from chronological retention

`maxHistoryCount` continues to mean the maximum number of unpinned chronological entries. Automatic trim removes only excess unpinned entries. Add a product constant `MAX_PINNED_HISTORY_COUNT = 100`; attempts to pin above the cap return a localized typed error and do not mutate history. Total persisted entries are therefore bounded by `maxHistoryCount + MAX_PINNED_HISTORY_COUNT`.

Pinned image paths remain live during cleanup. Unpinning does not immediately delete an item; it returns to chronological order and is then eligible for the same trim pass.

Alternative considered: count pins inside `maxHistoryCount`. Rejected because enough pins could prevent new clipboard items from ever appearing or force protected items to be evicted.

### 4. Use existing revisioned upsert/remove/clear paths

Pin/unpin is an entry update represented as the existing typed `Upsert` delta with no removed IDs. Add repository and Tauri commands for an explicit desired pin state; toggle is resolved against current repository state to prevent stale frontend state. CLI path helpers perform the same pure mutation and atomic persistence.

No full-history broadcast is introduced. Preview payload reconciliation receives the updated entry; open details remain on the same ID and update their pin affordance.

### 5. Make destructive semantics explicit

Deleting a selected ID removes it regardless of pin state because the target is explicit. Clearing all history may remove pins only through the existing confirmed action, but the GUI/CLI confirmation and result must state the pinned count included. Add a preserve-pins mode (`clear --keep-pinned` and the corresponding GUI choice) for users who intend to clear only chronological history; omission retains the existing clear-all contract.

This avoids silently changing current `clear --yes` behavior while providing a safe common workflow.

### 6. Treat pinning as part of visible history order

Create a compact pinned section before the configured main chronological slice. `mainWindowItemCount` continues to count unpinned entries; pins do not consume that allowance. Archive groups are calculated only from remaining unpinned entries, while search returns matching pins first followed by matching unpinned entries. Keyboard traversal follows rendered order and existing preview anchors.

Archive preview row numbers are local to the already-sliced group payload (`1..N`). They must not be derived from canonical `item.position`, because that position includes leading pins while archive ranges intentionally do not.

The main list marks the pinned-to-unpinned boundary with one quiet 2 px divider only when both groups are present. It does not render `Pinned`/`Recent` section labels or repeat a dot/icon beside each pinned row: the divider communicates the ordering boundary without creating a competing left-side track beside item numbers and image thumbnails.

The main window and archive preview remain clean, single-purpose browsing surfaces: their compact rows select or copy an item and do not carry inline pin controls. History details use the first header as a consistent action bar for pin/unpin and neighboring item actions such as delete or fullscreen. A dedicated pin shortcut is deferred to a later interaction proposal.

CLI `list/search/context/agent` use canonical order and accept `--pinned` where filtering is meaningful. `pin` and `unpin` require `--id` or one-based `--index`; JSON action results expose the final `isPinned` state without changing existing entry IDs.

Mutation results identify the entry that was actually created or deduplicated, never a positional neighbor. In particular, `mclip-cli add` resolves its result by the new text's stable content-derived ID after canonical sorting, because a pinned entry may remain at vector position zero.

## Risks / Trade-offs

- [Pins increase the maximum file size beyond `maxHistoryCount`] → Enforce a separate pin cap and retain existing image byte/cache bounds.
- [Old history lacks fields] → Use serde defaults, sanitize invalid pairs, and avoid rewriting until the next real mutation.
- [Index selection can shift after pinning] → Resolve a selector once, mutate by stable ID, and document one-based indexes as snapshot-relative.
- [Clear behavior can surprise users] → Preserve current clear-all semantics but show pinned counts and offer an explicit keep-pinned mode.
- [Multiple order implementations drift] → Keep the comparator/grouping functions pure and cover Rust plus frontend contract tests.

## Migration Plan

1. Add fields, defaults, sanitization, fixtures, and symmetric TypeScript types.
2. Add canonical ordering, pin cap, dedupe preservation, trim/image-cleanup behavior, and repository/path mutations.
3. Add typed commands/facades/events and CLI commands/filters.
4. Add desktop pinned section, previews, keyboard behavior, confirmations, and bilingual copy.
5. Update Agent capability metadata and public documentation after command behavior stabilizes.

Rollback code can read v0.2.0 history only if unknown common fields are tolerated by the older serde model; verify this explicitly. If not, rollback guidance must back up and transform `history.json` rather than discarding it.

## Open Questions

- Is 100 the desired pin cap after measuring worst-case history JSON and image-asset behavior, or should product testing choose a lower bound?
- Should a later version support manual pin ordering, or is most-recently-pinned ordering sufficient?
