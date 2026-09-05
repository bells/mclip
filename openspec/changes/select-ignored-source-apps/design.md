## Context

The current privacy page edits `ignoredSourceAppIds` through a technical text field. Source matching already uses normalized macOS bundle IDs, Windows executable names and X11 WM_CLASS; pure Wayland cannot enforce this setting.

## Goals / Non-Goals

Goals: native selection, recognizable rows, removal, immediate save/rollback, existing-record compatibility, three languages.
Non-goals: change clipboard detection, launch selected apps, migrate settings/history, or add global filesystem permissions.

## Decisions

- Use official `tauri-plugin-dialog` from Rust, with a parented native picker restricted to application files. A dedicated Preferences-only command returns `SourceApplicationOption { id, displayName, iconDataUrl }`, never paths. No frontend plugin permissions are needed because generic file operations are not exposed.
- macOS reads NSBundle metadata and NSWorkspace icons; Windows uses the selected executable filename, matching the existing detector; Linux accepts application launchers with explicit `StartupWMClass`, never guesses from `Exec` or launches them.
- Keep `ignoredSourceAppIds` as the only persisted truth. Resolve display metadata locally and retain identifier fallback rows when an app was removed or belongs to another platform. Mac icons are optional and bounded PNG data URLs; other platforms can use a generic application icon.
- Keep native IO on a blocking worker, prevent concurrent chooser instances, bound selections/metadata to 100 entries, and return stable content-free errors. Cancellation makes no changes. Invalid batches fail without partial changes.
- A focused React component owns list selection and chooser state, while the existing settings controller owns serialized persistence and rollback. Selected rows support keyboard navigation and accessible add/remove controls.

## Risks / Trade-offs

- Missing or unregistered applications → removable identifier fallback with a generic icon.
- Linux launcher without explicit WM_CLASS → explain that this app cannot be identified; preserve existing entries.
- Native chooser and tray behavior varies by OS → test local macOS APIs and browser interaction; report remaining native and Windows/Linux smoke separately.

## Migration Plan

No migration. Existing IDs load unchanged; reverting the feature restores the old entry interface.
