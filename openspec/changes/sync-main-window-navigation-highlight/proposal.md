## Why

The main window currently has keyboard focus state and pointer hover styling that can diverge, so users may see one row highlighted while arrow-key navigation continues from another target. The search box should be the clear default active target, and every subsequent keyboard or pointer movement should update one shared highlight consistently.

## What Changes

- Make the search box the default highlighted and focused target whenever the main window opens or is shown again.
- Use one active-target state for the search box, visible history rows, archive group rows, and enabled footer actions.
- Move the active highlight through targets in visible UI order with Arrow Up and Arrow Down, preserving the existing wrap and scroll-into-view behavior.
- Let pointer movement over a navigable target transfer the same active highlight so the next arrow-key action continues from the pointer-selected target.
- Keep item and group preview behavior synchronized with the active target while preserving the separate, non-focusable preview-window model.
- Use compact border-and-surface selected styling without an additional cyan outer ring on search, rows, archive groups, or footer actions.
- Add focused regression coverage for default activation, keyboard traversal, pointer takeover, and keyboard continuation after pointer movement.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `history-display`: Define a single synchronized main-window active highlight across search, history rows, archive groups, and footer actions for keyboard and pointer navigation.

## Impact

- Frontend main-window orchestration in `src/App.tsx` and the pure navigation model in `src/utils/keyboardNavigation.ts`.
- Search, history-list, archive-group, and footer component event contracts and active styling in `src/components/` and `src/uiStyles.ts`.
- Main-window keyboard/navigation regression tests, primarily `tests/keyboardNavigation.test.mjs`.
- No Rust IPC contract, Tauri capability, persistence format, dependency, or window-model changes are expected.
