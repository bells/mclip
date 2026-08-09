# mclip v0.1.1 Runtime Performance Report

## Result

The optimized macOS release path passes every measured startup, interaction, and bundle budget in `optimize-v0-1-1-runtime-performance`.

- Cold `processEntry -> trayReady` median improved from **449.12 ms** to **218.51 ms**: **51.3% faster**.
- Cold p95 improved from **470.22 ms** to **234.94 ms**: **50.0% faster**.
- Repeated viewer shell median improved from **384.62 ms** to **49.37 ms**: **87.2% faster**.
- The bootstrap JavaScript is **71,583 gzip bytes**, below the **75 KiB (76,800-byte)** budget.
- All measured resident interaction p95 values are below their absolute budgets.
- New settings retain **200** history entries by default and accept a symmetric Rust/TypeScript maximum of **500**; the formal 200-entry performance fixture remains unchanged for comparability.

Two validation boundaries remain open: the exact macOS pointer path from group preview into `preview-detail`, including dismissal-race coverage, and the Windows release-artifact/device benchmark plus full UI smoke. macOS results are not treated as Windows evidence.

## Protocol and Environment

| Field | Value |
| --- | --- |
| Release artifact | `src-tauri/target/release/bundle/macos/mclip.app` |
| Device | Apple M2, 8 CPU cores, 16 GiB memory |
| Platform | macOS 26.5.2, arm64 |
| Fixture | 50 mixed text/file/image entries under a system temporary directory |
| Sampling | 5 warm-ups + 20 measured runs per formal scenario |
| User data | Real config/history was not used |

The Rust and frontend monotonic clocks remain separate. Correlated interaction ids connect native visibility, frontend paint, and image-ready milestones without recording clipboard text, search queries, file paths, source-app names, or image bytes.

## Window Lifecycle

| Tier | Before | After |
| --- | ---: | ---: |
| Startup WebViews | 6 eager WebViews | 1 `main` WebView |
| Post-tray warm-up | 0 | 2 retained WebViews: `preview`, `preview-detail` |
| On demand | 0 | 3 retained WebViews: `about`, `preferences`, `image-viewer` |

Before optimization, every window parsed the same static frontend entry during process startup. After optimization, the native tray and `main` form the startup tier; preview windows warm without blocking main visibility, and low-frequency windows are created only on first use and then retained on hide.

## Frontend Transfer

All values below are gzip JavaScript bytes from the current Vite manifest. Route totals include the bootstrap plus that route's complete static request set.

| Request set | Gzip bytes | KiB |
| --- | ---: | ---: |
| Baseline single entry observed by proposal | 99,790 | 97.45 |
| Baseline instrumented single entry | 100,510 | 98.15 |
| Optimized bootstrap | 71,583 | 69.91 |
| `main` complete route | 90,357 | 88.24 |
| `preview` complete route | 88,314 | 86.24 |
| `preview-detail` complete route | 83,712 | 81.75 |
| `image-viewer` complete route | 84,026 | 82.06 |
| `about` complete route | 82,565 | 80.63 |
| `preferences` complete route | 89,743 | 87.64 |

The bootstrap is 28.8% smaller than the instrumented baseline and passes the 75 KiB critical-entry budget. Shared CSS remains **6,890 gzip bytes**; profiling found no style/layout/paint bottleneck that justified fragmenting it by route.

## Startup Measurements

| Milestone | Baseline median / p95 | Optimized median / p95 | Median change | Result |
| --- | ---: | ---: | ---: | --- |
| Rust `processEntry -> trayReady` | 449.12 / 470.22 ms | 218.51 / 234.94 ms | -51.3% | Pass: at least 20% faster; p95 improved |
| Frontend route to history ready | 144.00 / 176.00 ms | 98.00 / 112.00 ms | -31.9% | Pass |
| External launch to history ready | 767.21 / 816.01 ms | 568.96 / 604.73 ms | -25.8% | Pass |

## Resident Interaction Measurements

| Scenario | Baseline median / p95 | Optimized median / p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| Main interactive paint | 16.99 / 19.25 ms | 19.69 / 20.41 ms | p95 <= 120 ms | Pass |
| Text detail shell | 52.92 / 58.93 ms | 47.42 / 60.19 ms | p95 <= 120 ms | Pass |
| File detail shell | 52.62 / 53.08 ms | 50.54 / 51.93 ms | p95 <= 120 ms | Pass |
| Image detail shell | 52.56 / 52.81 ms | 50.76 / 51.59 ms | p95 <= 120 ms | Pass |
| Image detail ready | 52.75 / 52.99 ms | 50.95 / 51.82 ms | repeated p95 <= 250 ms | Pass |
| Viewer shell | 384.62 / 398.50 ms | 49.37 / 50.64 ms | p95 <= 250 ms | Pass |
| Viewer image ready | 384.38 / 398.18 ms | 49.17 / 50.45 ms | repeated p95 <= 300 ms | Pass |

The main-window median regressed by 15.9% and p95 by 6.0%, from an already small baseline. This is recorded rather than hidden; its optimized p95 remains 99.59 ms below the absolute budget. Text-detail p95 also rose by 2.1% while its median improved by 10.4%, and remains 59.81 ms below budget.

Profiling showed the former viewer cost came from replaying the macOS maximize animation on every open: native visibility completed about 1 ms after the request while frontend paint remained about 400 ms later. A hidden maximized viewer now stays maximized, so repeated opens avoid that transition. A viewer that the user restored still maximizes on its next open, and focus reinforcement and main-window layering recovery remain intact.

## History IPC Comparison

The byte comparison uses compact JSON for the same formal 50-entry interaction fixture and excludes Tauri transport-envelope overhead.

| Normal upsert path | Target deliveries | Payload bytes |
| --- | ---: | ---: |
| Baseline global full-array event | 6 | 13,784 per window; 82,704 total |
| Optimized main delta with preview present | 2 | 256 main upsert + 90 preview invalidation = 346 total |
| Optimized main delta without preview | 1 | 256 total |

For this representative upsert, the optimized path reduces delivered payload bytes by **99.58%** when preview exists and reduces target deliveries from six to two. `about`, `preferences`, and `image-viewer` receive zero full-history events. Exceptional external-file reconciliation can still use a typed `replace`; normal insert, dedupe, delete, trim, and clear paths use revisioned deltas.

## Image Cache

The formal interaction trace recorded **27 hits** and **3 misses**, a **90% hit rate**. The three unique 69-byte PNG fixtures produced 92 encoded bytes each, so peak retained encoded data was **276 bytes**. The production cache is bounded to **32 MiB total** with an **8 MiB per-entry** limit.

Verified behavior includes initial thumbnail misses; item-preview, group-detail, first-viewer, and repeated-viewer hits; viewer deletion and main recovery; metadata/path validation; and missing-asset failure without stale image data. History deletion, clear, trim, external replacement, and unused-asset cleanup invalidate matching entries.

## Functional and Quality Gates

- `npm run check` passed: frontend build, Rust formatting, 149 Rust library tests, 13 Agent CLI integration tests, 9 CLI install integration tests, Cargo check, and clippy with warnings denied.
- `node --test tests/*.test.mjs` passed: 150 tests.
- Focused bundle, auxiliary-ready registry, repository concurrency, delta reducer, preview reconciliation, image cache, performance privacy schema, window configuration, theme, and viewer tests passed within those suites.
- `git diff --check` passed.
- Strict OpenSpec validation passed.
- The eight pre-existing unarchived v0.1.1 changes remain present and were not modified or archived by this change.
- macOS release smoke verified main/item detail, image detail/cache flows, first and repeated viewer open, maximize/restore, Escape/delete recovery, About/Preferences repeated open, themes, and immediate-save behavior covered during implementation.

The local Windows cross-target check was attempted but cannot complete on this macOS host: `ring 0.17.14` fails because the MSVC C toolchain header `assert.h` is unavailable. This is an environment/toolchain boundary, not a successful Windows compile.

## Remaining Boundaries

1. Run a real pointer-driven macOS smoke for `group preview -> preview-detail`, then exercise leaving the full preview family and the dismissal race without synthesized route actions. This keeps task 3.7 open.
2. Run the same release milestone protocol on a Windows artifact or Windows device and complete tray, preview, viewer, clipboard, language, theme, and Preferences immediate-save smoke. This keeps task 8.5 open.

No change was archived, committed, or pushed as part of this apply session.

## Evidence Files

- `performance/baseline-v0.1.1.json`
- `performance/optimized-startup-v0.1.1.json`
- `performance/optimized-interactions-v0.1.1.json`
- `performance/frontend-bundle-route-split-v0.1.1.json`
- `performance/hot-path-profile-v0.1.1.json`
- `/private/tmp/mclip-image-cache-fixed-trace.jsonl`
- Formal cache trace: the temporary `trace.jsonl` emitted by `benchmark-interactions.mjs`
