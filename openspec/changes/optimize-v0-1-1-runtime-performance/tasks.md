## 1. Performance Baseline and Privacy Contract

- [x] 1.1 Define symmetric Rust/TypeScript performance milestone types, interaction ids, allowed fields, and a default-off local performance mode that rejects clipboard text, paths, source-app names, search queries, and image bytes.
- [x] 1.2 Add Rust and frontend milestone recorders for process/setup/tray, window request/native completion, route/listener/history paint, preview/viewer paint, and image load/error while keeping the two monotonic clock domains explicit.
- [x] 1.3 Build temporary empty, 50-entry, and 200-entry mixed-history fixtures plus benchmark commands that never resolve to the user's real config directory.
- [x] 1.4 Capture the pre-change release-build baseline with 5 warm-ups and at least 20 measured runs per cold-start, resident-main, text/file/image detail, and viewer scenario; record median, p95, current 99.79 KiB gzip entry bundle, and platform/fixture metadata.

## 2. Window-specific Frontend Loading

- [x] 2.1 Add focused tests that parse the Vite manifest and fail if the main initial JavaScript exceeds 75 KiB gzip or statically reaches About, Preferences, preview, or image-viewer route modules.
- [x] 2.2 Replace the static `App.tsx` dependency graph with a small label-aware bootstrap and dynamically imported window-root modules for main, preview, preview-detail, image-viewer, About, and Preferences.
- [x] 2.3 Keep diagnostics, error boundaries, theme foundations, and shared semantic CSS available to every route while proving auxiliary routes do not initialize `useClipboardApp` or main-only event subscriptions.
- [x] 2.4 Rebuild and inspect chunk/asset requests for every label, adjust only evidence-backed shared chunk boundaries, and store the post-split manifest comparison with the baseline.

## 3. Auxiliary Window Factory and Readiness

- [x] 3.1 Add Rust tests for a typed auxiliary-window descriptor covering exact labels, URL, logical sizes, transparency, focusability, resizability, always-on-top, taskbar, decorations, capabilities, and macOS corner behavior.
- [x] 3.2 Implement an idempotent auxiliary window registry/factory with generation ids, single-flight concurrent ensure, ready state, bounded timeout, destroy/retry cleanup, and typed `mark_auxiliary_window_ready` IPC.
- [x] 3.3 Make each auxiliary frontend route register all payload listeners before acknowledging its current generation, and add tests for late old-generation ready, concurrent ensure, retained-window reuse, and timeout recovery.
- [x] 3.4 Reduce `tauri.conf.json` startup windows to `main`, preserve all exact-label capability entries, and warm `preview`/`preview-detail` only after tray readiness or concurrently after an earlier main-show request without blocking main visibility/focus.
- [x] 3.5 Move About and Preferences to create-on-first-use/retain-on-hide behavior and verify centering, dialog drag bounds, immediate-save feedback, themes, Escape/close, and repeated open.
- [x] 3.6 Move `image-viewer` to create-on-first-use/retain-on-hide behavior; deliver payload only after ready, overlap cached image loading with native show/maximize, and preserve restore, delete, Escape, focus reinforcement, main layering, and failure recovery.
- [ ] 3.7 Run the exact cross-window macOS smoke for main-to-item preview, group-to-preview-detail pointer movement, first/repeated viewer open, maximize/restore, and dismissal races before removing the old static-window path.

## 4. Revisioned Desktop State Repository

- [x] 4.1 Extract pure history mutation results and file-fingerprint helpers from the current path-based code, retaining legacy parsing, stable ids, dedupe, copy counts/timestamps, trim, atomic writes, and image cleanup tests.
- [x] 4.2 Implement a managed `DesktopStateRepository` with sanitized settings, lazy/background history snapshot, monotonic revision, serialized mutation transactions, and commit-after-persist semantics.
- [x] 4.3 Move blocking history/settings read, JSON serialization, atomic persistence, and cleanup work off the UI thread and add concurrency/error tests proving failed persistence does not advance the in-memory revision.
- [x] 4.4 Load settings once for tray and frontend consumers, replace repeated desktop history reads with snapshot access, and keep `mclip-cli` default/explicit path workflows independent of Tauri managed state.
- [x] 4.5 Detect external history-file fingerprint changes before desktop mutations, reload/reconcile them into a new revision, and add a desktop-versus-CLI modification regression test that prevents stale overwrite.

## 5. Targeted Revisioned History Updates

- [x] 5.1 Define symmetric Rust/TypeScript `HistorySnapshot`, `HistoryChange`, and lightweight preview invalidation unions with camelCase serialization and explicit replace/upsert/remove/clear revisions.
- [x] 5.2 Add pure frontend reducer tests for insert, dedupe move, copy-count/time update, trim, delete, clear, replace recovery, duplicate delivery, and out-of-order revisions under active search/grouping.
- [x] 5.3 Return the initial snapshot once, send typed deltas only to main, and update `useClipboardDataController` to apply revisions without duplicate command/event mutations.
- [x] 5.4 Replace the preview family's complete-history listener with targeted invalidation and prove deletion, new clipboard insert, search changes, group reconciliation, and request revision still close or preserve exactly the intended preview.
- [x] 5.5 Remove the global full-array history broadcast after compatibility tests pass, and verify About, Preferences, and viewer no longer deserialize unrelated history updates.

## 6. Bounded Image Data Reuse

- [x] 6.1 Add Rust tests for image cache key validation, concurrent single-flight success/failure, LRU ordering, encoded-byte accounting, 32 MiB total bound, per-entry bypass, metadata change, missing file, and cleanup invalidation.
- [x] 6.2 Implement the managed Rust image-data cache around off-UI-thread file read/base64 encoding without placing bytes in cross-window events or persistent storage.
- [x] 6.3 Add a per-WebView promise registry to `useImageDataUrl`, cancellation-safe consumer handling, and tests proving same-window concurrent hooks share one IPC request without retaining unbounded results.
- [x] 6.4 Wire history deletion, clear, trim, external replace, and unused-asset cleanup to cache invalidation, preserving existing localized loading/error states and proportional rendering.
- [x] 6.5 Verify one image across main thumbnail, item preview, group detail, first viewer open, repeated viewer open, deletion, and missing-asset fallback while recording cache hit/miss and image-ready timings.

## 7. Evidence-backed Hot-path Cleanup

- [x] 7.1 Profile Rust setup/window calls, React commits/layout effects, IPC counts, style calculation, layout, paint, and compositing after the architectural changes; rank remaining costs using captured evidence.
- [x] 7.2 Move only proven invariant native window properties to creation time and coalesce only same-frame redundant React/window requests, preserving live monitor geometry, preview X on resize, pointer hit testing, viewer focus reinforcement, and zero perceptible debounce.
- [x] 7.3 Apply CSS or component memoization changes only where trace evidence shows a measurable bottleneck, and add a focused regression or budget for every accepted optimization.
- [x] 7.4 Remove superseded compatibility paths and split modules by single responsibility without changing public IPC behavior beyond the planned typed snapshot, delta, ready, and performance contracts.

## 8. Performance and Cross-platform Verification

- [x] 8.1 Run the optimized macOS release-build suite with the same fixtures and sampling protocol; require at least 20 percent median cold-start improvement, no more than 10 percent p95 cold regression, main/detail p95 budgets, viewer p95 budgets, and the 75 KiB gzip main-entry budget.
- [x] 8.2 Run all focused bundle, ready registry, repository, delta reducer, preview lifecycle, image cache, privacy-schema, window config, theme, and image-viewer tests.
- [x] 8.3 Run `npm run check`, all `node --test tests/*.test.mjs`, `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc` where supported, and `git diff --check`.
- [x] 8.4 Run `openspec validate optimize-v0-1-1-runtime-performance --type change --strict` and verify no implementation task modified or archived the existing v0.1.1 changes.
- [ ] 8.5 Validate the Windows release artifact or a Windows device with the same fixture/milestone protocol and full tray, preview, viewer, clipboard, language, theme, and immediate-save smoke; document any owner-approved absolute-budget exception with its required relative improvement and p95 evidence.
- [x] 8.6 Produce a final before/after report listing window count by tier, per-route bundle sizes, median/p95 timings, history IPC bytes/events, image cache hit rate/peak bytes, passed functional gates, and any remaining macOS/Windows manual boundary.
- [x] 8.7 Change new settings to default `maxHistoryCount` to 200, expand the symmetric Rust/TypeScript upper bound to 500, keep the 200-entry performance fixture comparable, and add focused regression coverage.
