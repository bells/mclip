## 1. Pin Contract and Migration

- [x] 1.1 Add failing Rust and Node contract fixtures for v0.1.1 entries without pin fields and invalid persisted pin-field pairs.
- [x] 1.2 Add serde-defaulted `is_pinned`/`pinned_at` fields to `HistoryEntryCommon` and exact camelCase fields to the TypeScript common contract.
- [x] 1.3 Implement pin metadata sanitization without rewriting history during read-only load.
- [x] 1.4 Define and test `MAX_PINNED_HISTORY_COUNT` and the total persisted-entry bound.

## 2. Canonical History Semantics

- [x] 2.1 Implement one pure canonical comparator for pinned and unpinned entries with stable tie-breaking.
- [x] 2.2 Apply canonical ordering after load, merge, pin, unpin, replacement, and external reconciliation.
- [x] 2.3 Preserve pin metadata and stable ID when duplicate content is copied while updating copy count and timestamps.
- [x] 2.4 Change automatic trimming to count/remove only unpinned entries and keep referenced pinned image assets live.
- [x] 2.5 Run the ordinary trim and unused-image cleanup after unpinning an entry.
- [x] 2.6 Add Rust tests for ordering, dedupe, cap errors, trim, image cleanup, clear-all, and keep-pinned clear behavior.

## 3. Repository, IPC, and CLI Mutations

- [x] 3.1 Add atomic repository/path helpers for pin, unpin, toggle, and keep-pinned clear using stable IDs.
- [x] 3.2 Emit pin changes through existing revisioned upsert deltas and avoid full-history broadcasts.
- [x] 3.3 Add typed Tauri pin commands and update `services/ipc`, the compatibility facade, `generate_handler!`, and focused command tests.
- [x] 3.4 Add `mclip-cli pin` and `unpin` selector parsing, atomic persistence, JSON action results, and pin-cap errors.
- [x] 3.5 Add `--pinned` filtering to applicable read/Agent commands without changing existing output formats for invocations that omit it.
- [x] 3.6 Add `--keep-pinned` to confirmed CLI clear while retaining existing `clear --yes` clear-all behavior and explicit pinned counts.

## 4. Desktop Pinned History Experience

- [x] 4.1 Add pure frontend selectors that split matching pins from matching chronological history and compute archives from unpinned entries only.
- [x] 4.2 Render a compact pinned section with one boundary divider before the configured unpinned main-window slice, without section labels, per-row pin markers, or flattened image rows.
- [x] 4.3 Add accessible pin/unpin affordances to detail action bars and bilingual labels without adding inline controls to compact main/archive rows or making previews focusable.
- [x] 4.4 Integrate pins into visible-order keyboard navigation, scroll-into-view, hover/focus preview anchors, and search results.
- [x] 4.5 Reconcile pin upserts across main, preview, preview-detail, and image-viewer payload history without reopening stale windows.
- [x] 4.6 Update clear/delete confirmation and result copy to state pinned counts and offer keep-pinned clearing.

## 5. Tests and Public Contracts

- [x] 5.1 Add Node tests for main/archive counts excluding pins, search order, archive labels and local row numbers, keyboard order, and independent preview behavior.
- [x] 5.2 Expand CLI integration tests for pin/unpin/filter/cap/dedupe/clear modes, add-result IDs behind pins, and stable Markdown/JSON/Agent schemas.
- [x] 5.3 Update README, AGENTS, bilingual site, `llms.txt`, CLI help, and content tests with exact pin and clear semantics.
- [x] 5.4 Verify v0.2.0 history with pin fields against the documented downgrade/backup path.

## 6. Verification

- [x] 6.1 Run `npm run check` and `node --test tests/*.test.mjs`.
- [x] 6.2 Run `npm run cli:test`, `npm run site:test`, `npm run site:build`, and `git diff --check`.
- [ ] 6.3 Smoke pin/unpin/dedupe/search/archive/clear behavior in the packaged macOS application and record Windows/Linux native boundaries separately.
- [x] 6.4 Run `openspec validate add-pinned-history-items --type change --strict` and resolve every validation finding.
