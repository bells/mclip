## Why

The current `m` menu-bar option is only a standalone handwritten letter, so it communicates the product name but not mclip's clipboard/notebook purpose. Reframing it as a compact notebook containing an `m` will make the status icon more distinctive while preserving the monochrome clarity required at native menu-bar sizes.

## What Changes

- Replace the existing standalone `m` artwork with a compact notebook silhouette containing a clearly recognizable lowercase `m`.
- Keep the icon monochrome, transparent, balanced, and legible at macOS menu-bar and Windows system-tray display sizes.
- Preserve native macOS Template Image recoloring for the redesigned `m` icon.
- Update the Preferences icon preview and localized accessible description so they represent the same redesigned asset.
- Keep the existing `menuBarIconStyle: "m"` value and immediate-save behavior; no settings migration or new icon option is introduced.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `appearance-settings`: Define the notebook-with-`m` visual contract, preview consistency, small-size legibility, and macOS template behavior for the existing `m` menu-bar icon option.

## Impact

- Affected assets: `src-tauri/icons/menu-bar-icon-m.png` and `src-tauri/icons/menu-bar-icon-m-128.png`, plus any canonical source or generation/validation tooling introduced for those derivatives.
- Affected UI: the existing Menu Bar Icon selector in `src/components/PreferencesWindow.tsx` and its Chinese, English, and Japanese accessible descriptions.
- Affected native behavior: the existing tray icon loading path in `src-tauri/src/lib.rs` must continue treating the `m` style as a Template Image on macOS.
- No change to IPC contracts, persisted setting values, defaults, dependencies, or the `appIcon` and `light` icon styles.
