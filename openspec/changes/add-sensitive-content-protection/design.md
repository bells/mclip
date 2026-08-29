## Context

mclip currently stores original clipboard content locally, renders it directly across the main and three detail surfaces, and exposes it through human-readable and structured CLI/Agent formats. `source_app` is a best-effort display name captured after clipboard parsing; there is no stable source identifier or ignore policy. Performance logging already prohibits clipboard content, queries, paths, and source-app names.

The feature has two distinct protections: masking content already accepted into history, and skipping capture from configured applications. Neither heuristic pattern matching nor foreground-app detection can guarantee that all secrets are found or excluded, especially on Wayland. The UI and docs must not describe this as encryption or a password-manager security boundary.

## Goals / Non-Goals

**Goals:**

- Classify a small high-confidence set of secret forms locally and deterministically.
- Mask classified content by default in every display/export surface while preserving exact copy behavior.
- Skip persistence for configured source applications when identity is available at capture time.
- Keep raw content and application identifiers out of logs, telemetry, and error payloads.
- Migrate existing history/settings without destructive rewrites.

**Non-Goals:**

- Encryption at rest, secure enclave/keychain storage, breach prevention, DLP compliance, or exhaustive credential detection.
- Uploading content to a detection service or using an LLM/network API.
- Guaranteeing ignored-app enforcement when the operating system does not expose foreground application identity.
- Masking image pixels or inspecting file contents in v0.2.0.

## Decisions

### 1. Use a pure bounded Rust classifier

Add a `sensitive_content` module using the mature Rust `regex` engine and `std::sync::LazyLock`. Detector version 1 rejects input larger than 64 KiB before scanning and uses linear-time patterns. Its categories are PEM private-key headers, three-segment JWT-shaped tokens, AWS `AKIA`/`ASIA` access-key IDs, and the explicit OpenAI `sk-proj-`/`sk-svcacct-` forms. The OpenAI list is deliberately narrow because official documentation retrieval was unavailable while freezing v1; it must be re-checked before adding a new prefix. Avoid broad `sk-`, entropy-only, or generic-secret rules because their false-positive rate is difficult to explain.

Persist `secretType: Option<SecretType>` and `secretDetectorVersion: Option<u16>` on the Text variant with serde defaults. `isSecret` is derived in DTOs rather than stored as a second potentially inconsistent boolean. Reclassification happens on new content and through a user-triggered bounded migration pass, not on load or every render. This keeps v0.1.1 history reads non-mutating and makes the one-time write explicit.

Alternative considered: store match ranges. Rejected because positions can become stale as detectors evolve and can reveal structural information unnecessarily; the mask function can rescan a classified value in bounded time.

### 2. Mask at serialization/presentation boundaries

Keep original text as the canonical local history value so selecting/copying an entry preserves exact content. Provide one shared masking function that returns the fixed localized-neutral `••••••••` mask for every v1 category; it never retains match fragments. Desktop view models and default CLI formatters use masked text and masked `displayText` for classified entries.

Raw content is available only when the user invokes a transient reveal control or an explicit CLI raw/reveal option. Existing `--raw` counts as explicit reveal to preserve its contract; other formats use `--reveal-secrets`. JSON includes classification metadata and the masked content by default. Reveal state is in-memory, per window/item, and cleared on item change, window hide, search change, or app restart.

The reveal command reconciles the desktop repository with external history-file changes before resolving the stable item ID. It returns structured, content-free error codes (`itemNotFound`, `classificationStale`, or `historyUnavailable`) instead of localized strings. A legacy text entry without classification metadata may be revealed only after the current bounded detector matches it in memory; that check never persists metadata. A missing or stale entry refreshes the main snapshot, closes the obsolete detail, and leaves a localized status message in the main window.

Alternative considered: overwrite stored text with masked text. Rejected because it destroys clipboard fidelity and prevents legitimate reuse.

### 3. Copy remains an explicit raw-content action

Selecting/copying a classified history item writes the original bytes to the system clipboard because the user chose that entry. UI confirmation is not added to the hot path, but secret styling and accessible labels make the action clear. Quick previews never reveal solely because an item is focused or hovered.

CLI commands that write a selected history item use the original content. Read-only commands remain masked unless an explicit reveal/raw option is present.

### 4. Capture source identity before reading full content

Change the watcher flow to query a `SourceApplicationIdentity { id, displayName }` at the observed clipboard-change boundary, compare its normalized identifier against settings, and only then read the snapshot. On macOS prefer bundle ID, on Windows prefer normalized executable identity, and on supported X11 use the best stable window/application identifier available. Pure Wayland returns an unavailable capability in v0.2.0.

`ignoredSourceApps` defaults to empty, is deduplicated and bounded, and stores stable normalized identifiers rather than arbitrary regexes. The Preferences picker may offer recently observed identities, but settings/events/logs must not emit the configured list as diagnostics. Matching is exact after platform normalization.

Alternative considered: ship a default password-manager blacklist. Rejected because application identifiers vary, foreground timing is best-effort, and silently skipping history would surprise users.

### 5. Make privacy status and limits visible

Add immediate-save settings for masking enabled (default true) and ignored source applications. The privacy page explains local plaintext storage, heuristic false positives/negatives, copy/reveal behavior, and the current platform's source-detection capability. A failed/unknown source lookup never claims an entry was ignored.

No secret content, pattern match, raw source-app name, ignored identifier, or private path is included in errors, traces, performance events, or Agent safety metadata. Tests use synthetic placeholders that cannot be mistaken for production credentials.

## Risks / Trade-offs

- [False negatives expose content] → Limit claims, version detectors, cover known patterns, and keep ignored-app controls as an independent layer.
- [False positives hide ordinary text] → Prefer high-confidence patterns, expose a type label, and allow transient explicit reveal.
- [Masking only protects presentation] → State plaintext-at-rest behavior in Preferences, docs, CLI help, and Release notes.
- [Foreground identity can be stale or unavailable] → Capture it before content reads, expose capability state, and never promise pure-Wayland enforcement.
- [CLI JSON consumers observe masked defaults] → Preserve explicit `--raw`, version Agent schemas if field semantics change, and document `--reveal-secrets`.
- [Detector fixtures could contain usable-looking keys] → Use unmistakably synthetic values and add repository secret-scan exclusions only if required.

## Migration Plan

1. Add serde-defaulted fields/settings and v0.1.1 fixtures; loading alone does not rewrite files.
2. Add pure detection/masking tests and an explicit bounded reclassification migration invoked by the user from Privacy Preferences. Loading alone never triggers it.
3. Route desktop DTOs and CLI formatters through masked presentation before adding reveal controls.
4. Move source identity lookup ahead of snapshot reads and add ignored-app settings/capability UI.
5. Run manual macOS/Windows/X11 ignored-app smoke; record pure-Wayland unavailability honestly.

Rollback must preserve original text. Older versions must be tested for tolerance of the added optional fields; otherwise release notes require a settings/history backup before downgrade.

## Resolved Questions

- Existing v0.1.1 entries are reclassified only through an explicit Privacy Preferences action, so read-only loading does not rewrite history.
- Explicit reveal may classify one legacy entry in memory to authorize that transient action, but it never persists the result or replaces the explicit bulk reclassification flow.
- Detector v1 recognizes only explicit OpenAI `sk-proj-` and `sk-svcacct-` forms. Broader or newly documented forms require a detector-version change and refreshed official evidence.
