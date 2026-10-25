## Why

The current green leaf does not match the owner's chosen maple identity. The owner selected the second generated concept: a rounded, muted russet maple leaf with a flowing lowercase m cutout and a transparent background.

## What Changes

- Replace desktop application icons and current static website branding with the selected maple mark.
- Keep all three tray choices and existing settings values: color maple (`appIcon`), monochrome maple (`light`), and the unchanged notebook (`m`).
- Derive monochrome and Windows/Linux contrast assets from the selected silhouette using the existing Tauri icon toolchain, with reproducible export and small-size previews.
- Update Chinese, English and Japanese icon labels. Preserve versioned videos and historical screenshots.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `appearance-settings`: selected maple branding, the three compatible tray choices, and preservation of the notebook icon.

## Impact

Desktop/website image assets, an icon export script, localized labels, asset tests and documentation. No IPC, settings schema, window lifecycle, version, updater, clipboard, release or installation changes. The existing tray bug repair remains separate. The earlier `refine-menu-bar-notebook-m-icon` source and derivatives are preserved.
