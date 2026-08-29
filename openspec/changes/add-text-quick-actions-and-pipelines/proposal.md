## Why

mclip already exposes clipboard history to desktop users and Agents, but common developer transformations still require copying into another tool, and the existing CLI does not provide a complete stdin/stdout workflow. v0.2.0 should add a small, deterministic transformation layer shared by the GUI and CLI without turning history selection into an implicit destructive edit.

## What Changes

- Add bounded text quick actions for JSON prettify/minify, Base64 encode/decode, and URL component encode/decode with deterministic UTF-8 behavior and actionable validation errors.
- Expose only applicable actions for text history entries in an independent detail/action surface that preserves the current compact window and keyboard model.
- Default transformed output to preview plus explicit copy; replacing a history entry requires a separate confirmed action and creates a normal revisioned mutation.
- Extend `mclip-cli copy` to accept exactly one input source from an existing history selector, `--stdin`, or piped stdin, while preserving explicit system-clipboard mutation semantics.
- Add `mclip-cli transform <action>` as a composable stdin/stdout command; successful stdout contains only transformed content and failures use stderr plus a non-zero exit code.
- Reuse one pure Rust transformation service from desktop commands and CLI parsing, with payload/size limits and no clipboard/history content in logs or telemetry.
- Keep existing `list`, `get`, `search`, `context`, and `agent` formats backward compatible except where users explicitly invoke new options or commands.

## Capabilities

### New Capabilities

- `text-quick-actions`: Shared transformation semantics, desktop applicability, preview/copy/replace behavior, error handling, and resource bounds.
- `cli-pipelines`: Unambiguous stdin/stdout contracts for copying and transforming content in terminal and Agent workflows.

### Modified Capabilities


## Impact

- New pure Rust transformation module, typed Tauri command wrapper, CLI parser/help/capability map, history mutation flow, and integration/unit tests.
- Text detail/preview UI, action affordances, keyboard handling, i18n, and compact-window sizing.
- README, AGENTS, bilingual site content, `llms.txt`, and CLI examples must stay aligned with the implemented command surface.
