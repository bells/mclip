## Why

Ignoring an application currently requires knowing and typing its platform identifier. A native application chooser and a recognizable list make this privacy setting accessible without technical knowledge.

## What Changes

- Replace identifier entry with an application list and add/remove controls inspired by Maccy and Clipy.
- Open a native chooser and derive exact source identifiers automatically; preserve immediate saving and existing exclusions.
- Resolve local display names and macOS icons, retaining removable fallback entries for missing applications.
- Handle cancellation, duplicates, limits, invalid selections and unavailable source detection in Chinese, English and Japanese.

## Capabilities

### New Capabilities
- `ignored-application-picker`: Native application selection and local presentation of excluded applications.

### Modified Capabilities
None. Exact source matching and persisted identifier semantics remain unchanged.

## Impact

Preferences, typed IPC, a Rust application-selection service, the official Tauri dialog plugin, and platform metadata APIs. No history migration, scanning clipboard content, release changes, or application launching.
