## 1. Transformation Contract

- [x] 1.1 Resolve the action-result window choice and input/output byte limits using a compact UI prototype and representative benchmarks.
- [x] 1.2 Add failing tests for all six actions, invalid JSON/Base64/percent input, non-UTF-8 Base64, UTF-8 boundaries, and size limits.
- [x] 1.3 Add `text_transform.rs` with typed camelCase actions/results/errors and direct reviewed dependencies for standards-based codecs.
- [x] 1.4 Implement deterministic JSON, RFC 4648 Base64, and URL component transformations with content-free errors.
- [x] 1.5 Add pure applicability helpers and ensure list render/hover never performs full transformations.

## 2. Typed Desktop Integration

- [x] 2.1 Add a bounded `transform_text` Tauri command and symmetric request/result types in `services/ipc` and the compatibility facade.
- [x] 2.2 Register the command and any required capabilities without granting shell or network permissions.
- [x] 2.3 Run transformation work off the UI thread and preserve action/duration-only performance diagnostics.
- [x] 2.4 Add a repository mutation that confirms text replacement, keeps stable ID/pin metadata, recomputes display/dedupe/sensitivity fields, and emits one upsert.
- [x] 2.5 Add Rust tests for replacement dedupe, revision, pin/sensitivity integration, and no-mutation error paths.

## 3. Desktop Quick Action Experience

- [x] 3.1 Add accessible text-only quick-action affordances to the appropriate detail surface with bilingual labels and applicability states.
- [x] 3.2 Implement the result surface as a lazy independent window or bounded in-window surface according to task 1.1 without widening `main` or focusing existing previews.
- [x] 3.3 Implement Copy through the normal clipboard flow, confirmed Replace through the repository, and Cancel as an in-memory discard.
- [x] 3.4 Integrate keyboard/Escape/focus handling and reset stale async results when selection, search, preview, or window lifecycle changes.
- [x] 3.5 Add Node tests for action applicability, result lifecycle, compact sizing, copy/replace/cancel, and preview independence.

## 4. CLI Copy Input Modes

- [x] 4.1 Refactor stdin/terminal reading behind a testable input abstraction shared with existing `add` behavior.
- [x] 4.2 Preserve `copy --index|--id` and add mutually exclusive `copy --stdin` plus implicit piped-stdin mode.
- [x] 4.3 Reject selector-plus-stdin, multiple selectors, invalid UTF-8, oversized input, and no-source terminal invocation before clipboard mutation.
- [x] 4.4 Implement Linux ownership handoff compatibility when the Linux change is present and preserve macOS/Windows copy behavior.
- [x] 4.5 Add integration tests for every input mode, stdout action result, stderr failures, exit codes, and history non-mutation.

## 5. CLI Transform Pipeline

- [x] 5.1 Add `transform <action>` parsing with exactly one `--text`, explicit stdin, or piped-stdin source.
- [x] 5.2 Keep successful transform stdout content-only and route usage/validation/runtime diagnostics to stderr with non-zero exit codes.
- [x] 5.3 Ensure transform help and parsing do not read history or write the clipboard.
- [x] 5.4 Update Agent command capability metadata, safety boundaries, top-level help, and focused integration tests.

## 6. Documentation and Verification

- [x] 6.1 Update README, AGENTS, bilingual site, `llms.txt`, CLI examples, and site content tests using safe synthetic pipelines.
- [x] 6.2 Run `npm run check`, `node --test tests/*.test.mjs`, and `npm run cli:test`.
- [x] 6.3 Run `npm run site:test`, `npm run site:build`, and `git diff --check`.
- [ ] 6.4 Smoke desktop preview/copy/confirmed replacement and CLI pipeline composition on native macOS, retaining Windows/Linux runtime boundaries.
- [x] 6.5 Run `openspec validate add-text-quick-actions-and-pipelines --type change --strict` and resolve every validation finding.
