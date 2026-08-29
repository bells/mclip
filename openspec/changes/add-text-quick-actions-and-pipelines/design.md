## Context

`mclip-cli` already has Agent Mode; read commands; `add`, `copy`, `delete`, and confirmed `clear`; and stdin support for `add`. Existing `copy` selects a stored entry by `--index` or `--id`, so the new pipeline input must extend that command without confusing a history selector with literal text. Desktop text details currently copy or delete entries and communicate through typed Tauri commands and revisioned history updates.

The requested transformations are deterministic local operations. `serde_json` and `base64` are already direct dependencies; a small standards-based percent-encoding dependency can cover URL component behavior. Keeping the implementation in Rust gives the desktop and CLI one contract and makes size/error boundaries testable without a WebView.

## Goals / Non-Goals

**Goals:**

- Provide predictable JSON, Base64, and URL-component transformations shared by desktop and CLI.
- Make the default desktop flow preview-first and non-destructive.
- Make stdin/stdout behavior composable and unambiguous while preserving current CLI commands.
- Bound CPU/memory use and keep transformed content out of logs/telemetry.

**Non-Goals:**

- A plugin marketplace, arbitrary scripts, shell execution, syntax-aware code formatting, file conversion, or network actions.
- Guessing Base64 character encodings other than UTF-8 or interpreting full URL structures.
- Automatically replacing a history entry when an action is clicked.

## Decisions

### 1. Define a typed pure Rust transform service

Add `text_transform.rs` with `TextTransformAction`, `TextTransformRequest`, `TextTransformResult`, and typed error codes. Actions are `jsonPrettify`, `jsonMinify`, `base64Encode`, `base64Decode`, `urlComponentEncode`, and `urlComponentDecode`. Input is valid UTF-8, Base64 uses RFC 4648 standard alphabet with padding, and URL operations target one component rather than a complete URL.

Use `serde_json`, `base64`, and a mature percent-encoding crate instead of handwritten parsers/codecs. Enforce a 1 MiB input limit and 4 MiB output limit before returning across IPC or stdout; implementation benchmarks may lower these values if UI responsiveness requires it, but Rust and TypeScript constants must remain symmetric.

### 2. Keep applicability explicit

Only text entries expose quick actions. JSON actions appear when bounded parsing recognizes a JSON value; Base64 decode appears only for syntactically valid input that decodes to UTF-8; Base64 encode and URL encode/decode remain available subject to size. Applicability helpers are pure and do not perform mutation.

Desktop invokes one typed Rust command and receives either output or a stable error code. No transformation runs automatically on hover, list render, or clipboard ingestion.

### 3. Use preview, copy, and confirmed replace as separate operations

Executing an action opens an in-window or dedicated action result surface sized independently from history preview windows. It never expands the `main` window or makes preview windows focusable. The result offers:

- Copy: write output to the clipboard; the normal watcher/dedupe path handles history.
- Replace: after confirmation, update the selected text entry under its stable ID, recompute display/dedupe/sensitivity metadata, preserve pin metadata, and emit one revisioned upsert.
- Cancel: discard the in-memory result.

Alternative considered: always create a new history entry. Rejected because the requested overwrite workflow remains useful, but it is kept explicit and confirmed.

### 4. Extend `copy` through mutually exclusive input modes

Preserve `mclip-cli copy --index N|--id ID`. Add `mclip-cli copy --stdin` and accept piped stdin when no selector is present. Exactly one source is allowed: selector or stdin. A terminal invocation with neither source returns usage instead of blocking; `--stdin` explicitly permits terminal reading. Successful output remains the action result on stdout; errors go to stderr and non-zero status.

Do not accept ambiguous positional literal text on `copy`; users can pipe `printf` or use `--stdin`. This keeps shell quoting and existing selector parsing clear.

### 5. Add a content-only transform command

`mclip-cli transform <action>` reads one source from `--text TEXT`, `--stdin`, or piped stdin. On success stdout is exactly the transformed content, with no prose, JSON envelope, or trailing diagnostic. `--json` is not offered for the data stream; optional machine-readable errors can be a future versioned stderr mode. Help/version/transform help remain history-independent.

The Agent capability map adds transform/copy-stdin facts and safety boundaries. Read/list output formats remain unchanged.

### 6. Keep content out of observability and public examples safe

Errors include action, error code, and byte counts but never input/output content. Performance data may record action and duration with anonymous interaction ID. Docs use non-sensitive synthetic examples and update README, AGENTS, bilingual site, `llms.txt`, and content tests together.

## Risks / Trade-offs

- [Large transforms freeze the UI or flood IPC] → Enforce byte limits in Rust before parsing/encoding and run expensive work off the UI thread.
- [Base64 decode semantics surprise users] → Require UTF-8 output for text actions and return a distinct non-UTF-8 error.
- [URL encode semantics are ambiguous] → Name and document the action as URL component encode/decode.
- [Replacing changes dedupe relationships] → Reuse history normalization/deduplication and emit a single repository mutation with focused tests.
- [Piped stdin detection behaves differently in tests] → Abstract input reading, cover terminal/non-terminal modes, and provide explicit `--stdin`.
- [CLI stdout becomes non-composable if status text leaks] → Keep transform stdout content-only and route all diagnostics to stderr.

## Migration Plan

1. Add pure transform types/engine/tests and size constants.
2. Add typed IPC and desktop applicability/result UI with preview/copy only.
3. Add confirmed replacement through the repository and regression-test pin/sensitivity metadata if those prerequisite changes are present.
4. Extend CLI input abstraction, copy stdin mode, transform command, help, Agent metadata, and integration tests.
5. Synchronize public documentation and run full frontend/Rust/CLI/site gates.

Rollback removes the new commands/actions without changing existing history. Any replaced entry is ordinary history data and remains readable by v0.1.1 unless other v0.2.0 metadata requires separate migration guidance.

## Open Questions

- Resolved during implementation: use a new lazy, focusable, fixed `quick-action` window at 560×420. It keeps `main` and the non-focusable preview family unchanged while giving confirmation and keyboard handling an independent lifecycle. Because `main` remains always-on-top while the result is visible, `quick-action` uses the same native window level and is focused after show so the main popover cannot cover it.
- Resolved during implementation: keep symmetric 1 MiB input and 4 MiB output limits. Release-mode representative benchmarks completed all six actions in approximately 0.5–11.4 ms; worst-case URL component encoding produced 3 MiB in approximately 8.0 ms on the implementation host.
