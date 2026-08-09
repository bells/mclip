## ADDED Requirements

### Requirement: Critical paths have privacy-safe performance measurements
The system SHALL expose repeatable local measurements for application readiness and high-frequency window interactions without recording clipboard content or user-identifying payloads.

#### Scenario: Record a cold application launch
- **WHEN** a release build starts as a new process under performance mode
- **THEN** it records durations for process entry, native setup, tray readiness, main route readiness, and initial history readiness
- **AND** each record contains only milestone names, window labels, anonymous interaction ids, durations, fixture sizes, and success or failure state.

#### Scenario: Record a resident interaction
- **WHEN** the user or benchmark opens the main window, a history detail, or the image viewer in an already running process
- **THEN** Rust native work and frontend paint acknowledgements are correlated by one interaction id
- **AND** image-shell readiness is reported separately from image decode readiness.

#### Scenario: Benchmark with isolated fixtures
- **WHEN** the performance suite runs with empty, default-size, or 200-entry mixed history fixtures
- **THEN** it uses a temporary configuration root
- **AND** it does not read, overwrite, log, or upload the user's real history, settings, search query, source-app names, file paths, text, or image bytes.

### Requirement: Startup work is limited to the critical window tier
The system SHALL make the native tray and main window ready without synchronously creating every auxiliary WebView.

#### Scenario: Start the background utility
- **WHEN** mclip starts
- **THEN** native diagnostics, global shortcut registration, clipboard watcher scheduling, tray creation, and the `main` WebView form the startup tier
- **AND** `about`, `preferences`, and `image-viewer` creation does not delay tray readiness.

#### Scenario: Warm the preview family
- **WHEN** the tray becomes ready and no higher-priority main-window action is waiting
- **THEN** the system may create `preview` and `preview-detail` in the background
- **AND** preview warming does not block main-window visibility or focus.

#### Scenario: User opens main before preview warming
- **WHEN** the user opens the main window before the preview family is ready
- **THEN** the main window becomes visible without waiting for preview creation
- **AND** preview readiness continues concurrently for subsequent detail actions.

### Requirement: Each WebView loads only its window route
The system SHALL split frontend modules by Tauri window responsibility so hidden or unrelated surfaces are excluded from the main-window critical dependency graph.

#### Scenario: Build the main route
- **WHEN** the production frontend is built
- **THEN** the main initial JavaScript request set is no larger than 75 KiB gzip
- **AND** it does not statically include About, Preferences, preview renderer, or image-viewer route modules.

#### Scenario: Load an auxiliary route
- **WHEN** an auxiliary WebView boots
- **THEN** it imports its own route and necessary shared foundations
- **AND** it does not initialize `useClipboardApp` or other main-only history orchestration.

#### Scenario: Evaluate CSS optimization
- **WHEN** CSS structure is changed for performance
- **THEN** build or runtime evidence demonstrates reduced critical CSS transfer, style calculation, layout, paint, or compositing cost
- **AND** source-file splitting or class renaming alone is not accepted as a performance gain.

### Requirement: Auxiliary windows use a reliable ready protocol
The system SHALL create auxiliary windows idempotently and SHALL not deliver a payload until the target window generation has registered its listeners.

#### Scenario: Open an auxiliary window for the first time
- **WHEN** a request targets an auxiliary window that does not exist
- **THEN** one creation operation is shared by concurrent callers
- **AND** the request waits for that window generation's typed ready acknowledgement before sending payload and showing it.

#### Scenario: Reopen a retained auxiliary window
- **WHEN** a previously created auxiliary window is hidden and requested again
- **THEN** the existing ready instance is reused
- **AND** the request does not create another WebView.

#### Scenario: Auxiliary window readiness times out
- **WHEN** the target window does not report ready within the bounded timeout
- **THEN** the request fails with an actionable error
- **AND** main-window visibility, focus, preview dismissal state, and always-on-top recovery remain valid.

#### Scenario: Old window generation reports ready
- **WHEN** a destroyed or replaced auxiliary window reports a late ready acknowledgement
- **THEN** the registry ignores that acknowledgement
- **AND** no payload is delivered to the wrong generation.

### Requirement: Desktop state avoids repeated blocking persistence work
The system SHALL reuse a revisioned in-memory settings and history snapshot in the desktop process while preserving the existing durable JSON behavior and CLI helpers.

#### Scenario: Read startup settings
- **WHEN** setup creates the tray and the main frontend requests settings
- **THEN** the sanitized settings file is parsed once for the desktop snapshot
- **AND** tray and frontend consumers receive the same sanitized value.

#### Scenario: Read history repeatedly
- **WHEN** main, clipboard, delete, or clear workflows request history after the snapshot is loaded
- **THEN** they reuse the current revisioned snapshot instead of synchronously re-reading and parsing `history.json`
- **AND** blocking file I/O and serialization do not execute on the UI thread.

#### Scenario: Persist a history mutation
- **WHEN** a history mutation succeeds
- **THEN** the system preserves stable ids, deduplication, truncation, atomic persistence, and unused image cleanup
- **AND** it publishes the new revision only after durable persistence succeeds.

#### Scenario: Detect external file modification
- **WHEN** another process changes the history file after the desktop snapshot was loaded
- **THEN** the desktop detects the changed file fingerprint before its next mutation
- **AND** reloads or safely reconciles the latest durable history instead of silently overwriting it with a stale snapshot.

#### Scenario: Use mclip-cli independently
- **WHEN** `mclip-cli` reads or mutates a default or explicit history path
- **THEN** it continues to use the path-based parsing and persistence helpers without requiring a running Tauri desktop state.

### Requirement: History updates minimize cross-window work
The system SHALL publish revisioned typed history changes only to windows that need them and SHALL reject stale revisions.

#### Scenario: Apply a normal history change
- **WHEN** a clipboard insert, deduplication move, deletion, truncation, or clear succeeds
- **THEN** the main window receives the minimum typed delta needed to reach the new snapshot
- **AND** applying the same or an older revision cannot duplicate or revert the change.

#### Scenario: Reconcile a visible preview
- **WHEN** a history change removes or invalidates the entry shown by `preview` or `preview-detail`
- **THEN** the preview family receives a lightweight invalidation with the new revision
- **AND** clears the affected preview without receiving the complete history array.

#### Scenario: Hidden unrelated windows exist
- **WHEN** history changes while About, Preferences, or image viewer windows are hidden or visible
- **THEN** those windows do not receive or reconcile a complete history array unless their active operation explicitly requires a result.

### Requirement: Image data work is bounded and reusable
The system SHALL coalesce duplicate image reads and base64 encoding while bounding memory and invalidating stale data.

#### Scenario: Concurrent consumers request the same image
- **WHEN** two hooks or WebViews request the same unchanged image concurrently
- **THEN** Rust performs one file read and one base64 encoding operation
- **AND** all callers receive the same successful or failed result.

#### Scenario: Reopen an unchanged image
- **WHEN** a previewed image is opened in the viewer before its cache entry is evicted
- **THEN** the encoded data is served from the bounded process cache
- **AND** image bytes are not copied into the cross-window viewer event payload.

#### Scenario: Image cache reaches its limit
- **WHEN** retaining another encoded image would exceed the configured total or per-entry limit
- **THEN** least-recently-used entries are evicted or the oversized entry is not retained
- **AND** cache memory does not grow without a fixed upper bound.

#### Scenario: Image asset changes or is removed
- **WHEN** file metadata changes, history cleanup deletes an asset, or a read fails
- **THEN** matching cached data is invalidated
- **AND** a later request cannot display stale bytes for a removed or changed asset.

### Requirement: Performance budgets gate the optimized release path
The system SHALL compare the same release build scenarios before and after optimization and SHALL preserve functional correctness while meeting interaction budgets.

#### Scenario: Compare cold startup
- **WHEN** at least 5 warm-up runs and 20 measured cold-process runs are completed on the same device and fixture
- **THEN** median `process-entry` to `tray-ready` is at least 20 percent faster than the pre-change baseline
- **AND** p95 is not more than 10 percent slower.

#### Scenario: Measure resident main and detail paths
- **WHEN** at least 20 measured resident interactions run after warm-up
- **THEN** main-window request to interactive paint p95 is at most 120 milliseconds
- **AND** a prewarmed text or file detail request to shell paint p95 is at most 120 milliseconds
- **AND** an image detail shell p95 is at most 120 milliseconds with repeated image-ready p95 at most 250 milliseconds.

#### Scenario: Measure image viewer paths
- **WHEN** at least 20 measured viewer interactions run after warm-up
- **THEN** request to visible maximized viewer shell p95 is at most 250 milliseconds
- **AND** repeated unchanged image-ready p95 is at most 300 milliseconds.

#### Scenario: Verify a platform whose cold WebView differs
- **WHEN** macOS and Windows release artifacts are evaluated
- **THEN** each platform reports its own cold and resident results using the same milestones and fixtures
- **AND** one platform's result is not used as proof for the other
- **AND** a platform-specific absolute-budget exception requires documented baseline evidence, at least 20 percent median improvement, no p95 regression beyond 10 percent, and explicit owner review.
