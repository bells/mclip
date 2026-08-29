## 1. Privacy Contract and Synthetic Fixtures

- [x] 1.1 Define the detector version, high-confidence secret categories, byte limits, mask rules, and explicit false-positive/false-negative claims.
- [x] 1.2 Add unmistakably synthetic fixtures for each category, ordinary near-misses, oversized input, and v0.1.1 history/settings migration.
- [x] 1.3 Add serde-defaulted text classification fields and symmetric TypeScript DTO fields without storing a redundant `isSecret` source of truth.
- [x] 1.4 Add immediate-save masking and bounded ignored-source settings with Rust sanitize and frontend normalize parity.

## 2. Detection and Masking Engine

- [x] 2.1 Add the reviewed Rust `regex` dependency and implement a `LazyLock` bounded local classifier with stable error/result codes.
- [x] 2.2 Implement one content-safe mask function for every supported category and near-miss behavior.
- [x] 2.3 Classify new text entries before persistence and recompute classification after explicit text replacement.
- [x] 2.4 Implement a one-time or explicitly triggered bounded legacy reclassification path according to the resolved design question.
- [x] 2.5 Add unit/property tests for detector linearity bounds, categories, mask output, UTF-8 boundaries, and content-free errors.

## 3. Source Application Exclusions

- [x] 3.1 Replace display-name-only source capture with a platform adapter returning stable identifier plus display name where available.
- [x] 3.2 Move source identity lookup and exact ignored-identifier matching ahead of full clipboard snapshot reads.
- [x] 3.3 Preserve macOS bundle and Windows executable best-effort detection and add supported X11 identity detection.
- [x] 3.4 Return explicit unavailable capability for pure Wayland source identity instead of claiming ignore enforcement.
- [x] 3.5 Add tests for normalization, exact matching, deduplication, cap enforcement, unavailable identity, and skipped history mutations.

## 4. Desktop Safe Presentation

- [x] 4.1 Route history rows, item details, archive previews, preview-detail, image-viewer text metadata, and search display through masked view models.
- [x] 4.2 Add an accessible transient reveal control whose state clears on item/search/window lifecycle changes and never activates on hover/focus alone.
- [x] 4.3 Keep copy/auto-paste behavior on classified entries byte-exact and make the sensitive action state visually clear.
- [x] 4.4 Add a compact bilingual Privacy Preferences section with immediate-save masking, ignored-source controls, capability status, and plaintext-at-rest disclosure.
- [x] 4.5 Verify privacy UI preserves dialog drag regions, transparent rounded clipping, and current Preferences save responsiveness.
- [x] 4.6 Make reveal reconcile external history, allow bounded in-memory legacy detection, return stable structured error codes, and close/refresh stale details with bilingual feedback.

## 5. CLI, Agent, and Diagnostics

- [x] 5.1 Mask classified entries by default in list/get/search/context/agent text, Markdown, and JSON formatters.
- [x] 5.2 Preserve explicit `--raw` reveal semantics, add `--reveal-secrets` where applicable, and mark both clearly in help.
- [x] 5.3 Keep CLI copy actions on original content without echoing it and version Agent schema fields if default semantics require it.
- [x] 5.4 Audit logs, events, errors, performance milestones, and capability diagnostics to exclude content, match fragments, paths, source names, and ignored identifiers.
- [x] 5.5 Expand CLI/Agent integration tests with synthetic classified entries, masked defaults, explicit reveal, and action-result redaction.

## 6. Documentation and Verification

- [x] 6.1 Update README, AGENTS, bilingual site/changelog, `llms.txt`, CLI help, Release copy, and content tests with heuristic and plaintext-storage limits.
- [x] 6.2 Run `npm run check`, `node --test tests/*.test.mjs`, `npm run cli:test`, `npm run site:test`, `npm run site:build`, and `git diff --check`.
- [ ] 6.3 Smoke masked display, reveal reset, and ignored-app capture on native macOS and Windows using synthetic values.
  - macOS 2026-08-27: current release bundle built successfully, but the tray-only `LSUIElement` exposed no attachable Computer Use window; manual menu-bar smoke remains required.
  - Windows 2026-08-27: a Windows 11 Parallels VM booted, but Parallels Standard disables `prlctl exec` and Computer Use could not inject input into the VM window, so the current source could not be built or exercised there. The VM was returned to suspended state. The local target check reached `ring` and then stopped because the macOS host lacks MSVC C headers (`assert.h`).
  - Manual completion: copy `sk-proj-SYNTHETIC_FIXTURE_NOT_A_REAL_KEY_1234567890` from TextEdit and Notepad; verify masked row/detail/preview, explicit reveal, reset after item/search/window changes, byte-exact copy, then add `macos:com.apple.textedit` / `windows:notepad.exe` to ignored sources and verify a new copy creates no history mutation.
- [ ] 6.4 Smoke supported X11 exclusion and record pure-Wayland source-app unavailability without marking it passed.
  - Linux 2026-08-27: no X11 or pure-Wayland runtime session was available. Unit tests and bilingual docs record `pureWaylandSourceIdentityUnavailable`; X11 ignored-source behavior still requires a real session.
  - Manual completion: on X11, record the target application's normalized `WM_CLASS`, add the corresponding `x11:<wm-class>` identifier, copy the same synthetic value, and confirm no history mutation; on pure Wayland, confirm Preferences reports unavailable and do not mark source exclusion as enforced.
- [x] 6.5 Run a repository secret scan appropriate for synthetic fixtures and confirm no usable credentials were introduced.
- [x] 6.6 Run `openspec validate add-sensitive-content-protection --type change --strict` and resolve every validation finding.
- [x] 6.7 Add regression coverage for legacy reveal, normal reveal, deleted/stale entries, classification mismatch, stable frontend error routing, and repository failure where practical.
