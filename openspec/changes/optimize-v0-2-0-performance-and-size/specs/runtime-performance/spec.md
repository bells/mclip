## ADDED Requirements

### Requirement: Complete Runtime Response Measurement

Performance verification SHALL cover process startup, resident operation, and first/repeated responses for all seven window labels. Measurements SHALL use isolated synthetic histories at 0, 10, 50, 500 and 1000 ordinary entries, with pinned entries tested separately, and report sample counts, median/p95 and evidence limitations. Performance traces SHALL remain disabled by default and exclude content, queries, source identifiers and private paths.

#### Scenario: Startup and resident work

- **WHEN** the runtime optimization is evaluated
- **THEN** record process-entry to tray-ready, history-ready and first visible main paint separately
- **AND** distinguish fresh-process startup from warm filesystem caches
- **AND** measure idle and active CPU, application and attributable WebView process RSS, history insert/dedupe/delete/pin, external reconciliation and image cache hits/eviction

#### Scenario: Every page is evaluated

- **WHEN** page response is evaluated
- **THEN** cover main search/selection, group navigation and preview-detail hover, image-viewer open/restore/close, About first/repeated open, Preferences six-page navigation/search/serialized save, and quick-action conversion/display
- **AND** distinguish Rust processing, IPC/ready waiting, React commit and native visible paint
- **AND** retain first-use latency rather than hiding it among warmed repetitions

#### Scenario: Evidence boundaries remain explicit

- **WHEN** synthetic core or mocked browser measurements pass
- **THEN** they do not complete native startup, pointer/focus, CPU/RSS, Windows or Linux session acceptance
- **AND** slow candidates are changed only after profiling, with unchanged clipboard, privacy, revision, window readiness and immediate-save behavior

### Requirement: Proportional Desktop Read Work

Desktop reads SHALL reconcile external changes without constructing an unused previous snapshot. A single-item lookup SHALL clone only the matching entry. Owned presentation snapshots SHALL mask sensitive fields without recloning ordinary history entries.

#### Scenario: Cached read and lookup

- **WHEN** cached history is read or an entry is selected by ID
- **THEN** file fingerprint reconciliation and revision semantics remain intact
- **AND** missing IDs return no entry without copying the history array

#### Scenario: Masked snapshot preserves originals

- **WHEN** a presentation snapshot is masked
- **THEN** both sensitive text and display text become the fixed mask
- **AND** repository originals remain unchanged for explicit reveal and copy

#### Scenario: Unrelated preferences preserve the current history snapshot

- **WHEN** a preference unrelated to sensitive-content presentation is saved
- **THEN** the frontend reuses its current history snapshot instead of requesting a full replacement
- **AND** trimming and external history changes still arrive through revisioned change events
- **WHEN** masking changes while a snapshot request is pending
- **THEN** the old presentation response is discarded and the latest presentation is fetched after the pending request settles
