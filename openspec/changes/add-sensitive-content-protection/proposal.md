## Why

Clipboard histories can accidentally retain and redisplay credentials, private keys, and tokens, and Agent-oriented CLI output makes accidental disclosure more consequential. v0.2.0 should reduce this risk with local detection, safe-by-default presentation, and source-application exclusions while clearly stating that heuristic detection and foreground-app identification are not security guarantees.

## What Changes

- Detect a bounded, versioned set of high-confidence secret patterns in text entries and persist classification metadata without changing the original clipboard bytes.
- Mask detected values by default in desktop lists/details/previews and CLI/Agent output; reveal raw content only through an explicit, transient user action or explicit CLI flag.
- Add ignored-source-application settings that skip capture before history persistence when the current source app can be identified.
- Provide platform capability/status feedback: unknown or unavailable source-app detection must not be represented as a successful blacklist match, especially on pure Wayland.
- Keep settings immediate-apply/immediate-save, normalize ignored identifiers, and provide Chinese and English privacy explanations and false-positive limitations.
- Avoid telemetry, logs, events, or diagnostics containing raw detected secrets, clipboard text, private file paths, or ignored application names.
- Preserve existing local plaintext storage for v0.2.0 and state that masking is presentation protection, not encryption at rest.

## Capabilities

### New Capabilities

- `sensitive-content-protection`: Secret classification, masked presentation, explicit reveal, safe CLI output, source-app capture exclusions, migration, and honest capability/error behavior.

### Modified Capabilities


## Impact

- Rust history model and persistence, clipboard ingestion order, source-app adapters, settings sanitization, desktop repository events, CLI formatting, and diagnostic redaction.
- Symmetric TypeScript types, history list/detail/preview components, Preferences privacy controls, i18n, and Agent-facing output/docs.
- New focused pattern/masking tests using synthetic fixtures only; platform smoke is required for ignored-app behavior.
