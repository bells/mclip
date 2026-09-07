# Interface refinement verification

Baseline: `9386d2a`, source version `0.1.1`. At apply start only this proposal and the unrelated `prepare-v0-2-0-release` directory were untracked. No real clipboard history is read for UI evidence; all fixtures are synthetic. Old change completion states remain unchanged.

Scope: tray Preferences entry; notebook m optical size; Preferences navigation/search and six pages; grouped transforms and result window; light/dark/system themes across main, preview, preview-detail, image-viewer, quick-action, About and Preferences.

Evidence categories are separate: automated tests, synthetic browser rendering, native macOS, native Windows, named Linux X11 and Wayland sessions. Native checks remain pending unless explicitly recorded below.

The proposal's `ui-review.md` contains the pre-change source review and limited browser baseline. A complete pre-change screenshot matrix was not captured before implementation; task 1.2 remains incomplete and is not retroactively claimed.

## Implementation

- Native menu: localized Preferences / separator / Quit; existing status item and menu items retained during language changes. Uses the existing async Preferences command and lazy ready registry. Opening emits a main-window preview reset, hides main/preview, and invalidates native requests still waiting for ready.
- Notebook m: 1.09 uniform scale, optical center (12,12), unchanged canonical markers and setting value; generated 512/128 alpha PNGs.
- Navigation (updated 2026-09-08): General group / Behavior destination; language lives in Appearance, main/group display counts live in History. Stable setting IDs and data bounds remain intact.
- Transform discovery: grouped direct actions, delayed loading, retry and empty states; masking and all-disabled paths skip IPC. Result shell fills the window; Copy primary, Replace secondary plus danger confirmation. Synchronous guard prevents overlapping writes and invalidates stale payload completions.
- Theme: shared hook receives saved settings in all mounted windows and listens to OS scheme changes; explicit themes remain explicit. CLI badge has one semantic color; sensitive badge uses a defined token at 10px. Privacy copy states plaintext/masking limits without detector jargon.

## Checks and remaining evidence

Initial implementation checks completed on 2026-09-07; the 2026-09-08 follow-up results below supersede the affected layout and navigation evidence. No version, tag, release, commit or archive is part of this change.

| Check | Executed result |
| --- | --- |
| `pnpm run check` | Passed: frontend build, Rust fmt, Rust tests (218 library passed / 1 ignored, plus 20 CLI integration and 9 installer integration), cargo check and clippy |
| Final frontend-only follow-up | `pnpm run build` passed after separating discovery and action revisions on preview close; Rust was unchanged after the full gate |
| `node --test tests/*.test.mjs` | 208 passed, 0 failed on the 2026-09-07 source |
| Windows `cargo xwin check --locked ... --all-targets` | Passed; user cache symlink needed sandbox escalation. Source compatibility only, no native runtime evidence |
| `pnpm run site:test`, `pnpm run site:build` | Passed after README wording updates |
| OpenSpec strict validation | Current change passed; all 24 entries passed |
| `git diff --check` | Passed |
| Impeccable static detector | No findings in the five targeted UI/style files; it is not visual or native proof |
| Contrast | Reproducible CSS alpha composition over white/black passed 4.5:1 text and 3:1 meaningful control/focus thresholds; exact ratios in `evidence/contrast.json` |

### Browser evidence

All browser evidence is synthetic IPC, not a running native mclip. Earlier review used Chrome; final captures use the Codex in-app browser on macOS, CSS viewports 820×600 (Preferences), 560×420 (result), 304×393 (detail). The last detail capture checks a bounded text-action allocation, not every native screen size.

- `preferences-{light,dark}-{0..5}.png`: Startup & behavior, Appearance, History, Privacy, Text Actions, Agent CLI. Both themes captured; the final Appearance screenshots were visually inspected. Earlier session also inspected Japanese long labels and successfully searched `language`, navigated to Appearance, and focused the language select.
- `result-dark-ja.png`: long Japanese result at 560×420. DOM measured main height 393 and footer bottom 420, with result scrollHeight 3618; full background and reachable footer confirmed.
- `result-light-en.png` and `result-light-en-confirm.png`: short English result, failed mock copy preserved output and showed retry feedback; Replace opened the confirmation dialog.
- `preview-dark-ja.png`: direct type rows and complete labels at 304px width, with text and metadata visible.
- `discovery-error.png`: applicability failure; clicking Retry restored grouped actions.
- `discovery-privacy.json`: masked text, masked + all actions off, and ordinary text + all actions off each made **zero** applicability calls. The reveal hint disappeared when all actions were disabled.
- `theme-events.json`: **42/42** checks passed across all seven mounted window routes: system light/dark changes, saved explicit light/dark, and opposite OS changes. Routes were exercised separately; this is a synthetic media/settings event test, not simultaneous native OS switching.
- `icon-comparison.svg`: reproducible old/new 16/18/22px raster comparison, actual size plus enlargement. Dark row simulates Template tint. Generated successfully; final visual sign-off of this comparison and native icon rendering remain pending.

### Unfinished acceptance (implementation is present)

Task checkboxes include implementation **and** the requested full evidence matrix, so partial evidence does not check an entire task. 13/27 composite tasks are complete. The four requested feature changes are implemented; the remaining tasks are evidence/sign-off gaps:

- 1.2: complete pre-change seven-window / three-language screenshot baseline was not captured.
- 2.2: registry/lifecycle regressions and preview invalidation source are covered, but the complete tray-triggered delayed-create/old-request native path has not been exercised.
- 3.2: comparison artifact exists; full raster/native visual sign-off remains.
- 4.3: stable search descriptors and language search/focus passed; exhaustive three-language search/scroll/Escape matrix remains.
- 5.2–5.4: loading/empty rendering, rapid item/remask/close scenarios and delayed writes against new result payloads need the remaining browser matrix. Mutex and payload invalidation unit tests passed; copy failure and Replace confirmation were exercised. The shared action revision now invalidates on preview close without cancelling applicability discovery, preventing a hidden pending query from leaving the next open permanently loading.
- 6.1/6.4: current CLI color, privacy layout and existing pin/delete/viewer/Linux contracts are covered; all CLI version colors, full related visual interaction matrix and native paths remain.
- 7.2: representative light/dark and Chinese/English/Japanese evidence exists; the exhaustive state × language matrix is incomplete.
- 8.1–8.4: macOS device, Windows DPI/native tray, named X11 and named Wayland session matrices remain pending. No runtime claim is inferred from cross-compilation.

The final browser batch (loading/empty and stale-copy fixture) was rejected by automatic approval review because the account usage limit was reached. It did not run. Per the user's request to finish promptly, no further visual expansion or alternate browser execution was attempted. Existing saved evidence is retained, and the unfinished scenarios remain unchecked.

## Spec coordination

Follow design decision 7 when a later explicit sync occurs: replace the old settings-center General/language/history-display placement clauses with this change's IA, retain all serialization, retention, pin and immediate-save rules; combine notebook optical sizing and text transform presentation with their existing behavioral clauses. Strict validation alone does not resolve these semantic conflicts. No old delta or task state is changed here.


## 2026-09-08 screenshot feedback follow-up

All four requested corrections are implemented:

1. Both compact detail windows measure intrinsic header/content/footer with ResizeObserver and a shared hook. Native `resize_history_detail_window(app_handle, window, preview_height)` is called by typed `resizeHistoryDetailWindow(previewHeight)` and restricts the injected caller to preview/preview-detail. Resizing requires visible main and target, preserves X, clamps Y/height to the monitor work area and never shows/focuses a window. Deferred measurements/listeners are cancelled on item change/unmount. Native placement events follow show so retained windows remeasure on reopening. Content over 360 logical pixels scrolls; the full-size viewer is excluded.
2. Shared switch tracks have no hover fill override; dimensions, focus-visible, disabled and immediate-save behavior remain.
3. The page reads 行为 / Behavior / 動作.
4. Main/group counts appear under History > List display, including search destinations and stable focus anchors; Appearance retains language/theme/icon/branding/numbers.

Verification on current source: `pnpm run check` passed (218 Rust library passed, 1 ignored; 20 CLI and 9 installer integration passed); `node --test tests/*.test.mjs` passed 209/209; Windows x64 cargo-xwin all-target source check passed after allowing its user-cache symlink update; site tests/build and all 24 strict OpenSpec entries passed. Diff whitespace passed. No native runtime validation is claimed.

Targeted synthetic IPC browser evidence uses Codex in-app browser on macOS:

- `evidence/followup-short-dark.png`: preview route, short text with two actual conversion rows, 304×268; metadata bottom267, content-to-metadata gap10px. Initial old estimate was336px.
- `evidence/followup-json-light.png`: preview-detail route, multiline JSON with three conversion rows, 304×343; metadata bottom342, gap10px.
- For these geometry checks the browser viewport was set to the height captured from the actual resize IPC call. This verifies DOM measurement and final layout, not execution of the native resize command.
- `evidence/followup-history-light.png`: History shows capture types, retention max and both display count inputs at820×600. Dark Appearance DOM confirms both count controls absent.
- `evidence/followup-switch-dark.png` and `evidence/followup-layout.json`: after on→off with pointer remaining over the control, off-track color equals pointer-away color in light (`rgba(15,31,26,0.16)`) and dark (`rgba(226,232,240,0.12)`). Both aria-checked values are false.

Earlier `preferences-*` screenshots show the previous naming/control locations; earlier detail sizing evidence predates this correction. They are historical evidence only. The native macOS/Windows/Linux matrix and other previously open acceptance tasks remain open. Source version remains0.1.1; no commit, release, archive or user-data mutation.
