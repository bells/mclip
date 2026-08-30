## ADDED Requirements

### Requirement: Native Linux clipboard backends
The Linux desktop application SHALL use the maintained in-process `arboard` X11 backend and SHALL enable its Wayland data-control backend without requiring external clipboard executables.

#### Scenario: X11 session
- **GIVEN** mclip runs in an X11 session
- **WHEN** the clipboard watcher starts
- **THEN** mclip uses the X11 Clipboard selection in process
- **AND** does not invoke `xclip`, `xsel`, `wl-copy`, or `wl-paste`.

#### Scenario: Supported Wayland data-control session
- **GIVEN** `WAYLAND_DISPLAY` is set
- **AND** the compositor supports an enabled data-control protocol
- **WHEN** the clipboard watcher starts
- **THEN** mclip uses the Wayland data-control backend before attempting X11/XWayland.

#### Scenario: Wayland data-control unavailable with XWayland
- **GIVEN** Wayland data-control initialization fails
- **AND** an X11/XWayland clipboard is available
- **WHEN** the clipboard watcher starts
- **THEN** mclip falls back to the X11 backend
- **AND** reports clipboard history as degraded rather than unavailable.

#### Scenario: Pure Wayland clipboard unsupported
- **GIVEN** Wayland data-control initialization fails
- **AND** no X11/XWayland clipboard is available
- **WHEN** the clipboard watcher starts
- **THEN** mclip reports clipboard history as unavailable with a stable reason code
- **AND** does not report an empty clipboard as successful monitoring.

### Requirement: Linux clipboard history parity
On a session with an available clipboard backend, mclip SHALL preserve its text, image, and file-list history semantics and SHALL poll without reading full content when the clipboard signature is unchanged.

#### Scenario: Text history round trip
- **GIVEN** text history is enabled
- **WHEN** a user copies non-blank UTF-8 text in a supported Linux session
- **THEN** mclip stores one text entry using the existing dedupe and revision rules
- **AND** selecting it writes the exact text back to the Clipboard selection.

#### Scenario: Image history round trip
- **GIVEN** image history is enabled
- **WHEN** a user copies a supported image in a supported Linux session
- **THEN** mclip stores the normalized PNG asset under the existing image bounds
- **AND** selecting it writes image data back to the Clipboard selection.

#### Scenario: File list takes priority
- **GIVEN** file history is enabled
- **AND** the Clipboard selection exposes a `text/uri-list` plus image or text fallbacks
- **WHEN** mclip reads the changed clipboard
- **THEN** mclip stores one files entry with decoded absolute paths
- **AND** selecting it writes a Linux URI file list rather than plain path text.

#### Scenario: Unchanged clipboard signature
- **GIVEN** the Linux watcher has captured the current signature
- **WHEN** the polling interval elapses without a signature change
- **THEN** mclip does not read or process the full clipboard payload.

### Requirement: Linux clipboard ownership lifetime
mclip SHALL keep the Linux clipboard owner capable of serving content after desktop and CLI write operations.

#### Scenario: Desktop write remains pasteable
- **WHEN** the running desktop application writes a history entry to the Linux clipboard
- **THEN** its long-lived clipboard backend remains available to serve paste requests
- **AND** another application can paste the content after the write command returns.

#### Scenario: CLI write handoff
- **WHEN** `mclip-cli` writes content to the Linux clipboard
- **THEN** it uses a bounded ownership handoff compatible with Linux selection semantics
- **AND** it returns a non-zero error if it cannot establish a reliable handoff.

### Requirement: Linux desktop capability reporting
mclip SHALL expose typed `available`, `degraded`, or `unavailable` status for clipboard history, clipboard write, tray activation, global shortcut, source-app detection, and launch at login.

#### Scenario: Capability failure is visible
- **GIVEN** global shortcut registration fails while tray activation remains available
- **WHEN** Preferences reads desktop capabilities
- **THEN** the shortcut capability is `unavailable` or `degraded` with a stable reason code
- **AND** tray activation remains independently `available`.

#### Scenario: Pure Wayland source application identity
- **GIVEN** mclip runs in a pure Wayland session where foreground-app identity is unavailable
- **WHEN** capabilities are queried
- **THEN** source-app detection is `unavailable`
- **AND** mclip does not claim source-based ignore rules are enforced.

#### Scenario: Capability diagnostics protect user data
- **WHEN** mclip records a capability diagnostic
- **THEN** it may include the capability, status, reason code, and session kind
- **AND** it excludes clipboard content, file paths, source-app names, and configured ignored identifiers.

### Requirement: Linux tray, window, and shortcut behavior
On supported Linux desktops, mclip SHALL retain the tray-first show/hide flow, compact fixed-width main window, non-focusable independent previews, and global shortcut behavior.

#### Scenario: Tray activation positions the main window
- **GIVEN** a supported tray implementation and any monitor/panel edge
- **WHEN** the user activates the mclip tray icon
- **THEN** the main window opens adjacent to the activated icon on the same monitor
- **AND** the final frame is clamped to that monitor's work area.

#### Scenario: Preview windows remain independent
- **WHEN** a Linux user opens an item or archive preview
- **THEN** the existing lazy `preview` and `preview-detail` windows are used
- **AND** neither preview window becomes focusable
- **AND** the main window width is unchanged.

#### Scenario: Shortcut unavailable
- **GIVEN** the desktop environment denies global shortcut registration
- **WHEN** application startup completes
- **THEN** mclip remains usable through its tray or visible fallback entrypoint
- **AND** exposes shortcut remediation instead of terminating.

### Requirement: Linux launch at login
The Linux launch-at-login setting SHALL use a user-scoped graphical-session autostart mechanism and SHALL NOT install a systemd service or require administrator access.

#### Scenario: Enable launch at login
- **WHEN** a Linux user enables `launchAtLogin`
- **THEN** mclip creates or enables its XDG-compatible user autostart entry
- **AND** the setting is saved immediately.

#### Scenario: Autostart write fails
- **GIVEN** the user autostart directory is not writable
- **WHEN** a Linux user enables `launchAtLogin`
- **THEN** mclip returns an actionable error
- **AND** does not persist a false enabled state.

#### Scenario: No systemd daemon
- **WHEN** mclip is installed or launch at login is enabled
- **THEN** it does not install `mclip.service`
- **AND** does not start a second history-writing process.
