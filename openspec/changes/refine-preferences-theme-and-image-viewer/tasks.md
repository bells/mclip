## 1. Preferences Structure and Window Bounds

- [x] 1.1 Update focused Preferences tests to require vertically stacked interface fields, grouped General settings, the History tab label/order, and preserved immediate-save behavior.
- [x] 1.2 Refactor `PreferencesWindow` and shared style mappings into Interface, Startup and Behavior, and Main Window groups without changing the existing setting state or save queue.
- [x] 1.3 Rename the visible Storage tab to History in both languages, reorder its settings, raise long permission notes to readable 11px text, and update the fixed Preferences window to approximately 600×480.

## 2. Theme Semantics and Contrast

- [x] 2.1 Add regression coverage for semantic active-control, accent-action, danger-action, and light selected-row tokens in both themes.
- [x] 2.2 Replace the hardcoded switch blue and mixed light selection gradient with semantic theme tokens while preserving the existing cold-green, warm-gold, teal, and danger palette.
- [x] 2.3 Apply theme-specific foreground tokens to accent and danger actions and verify their normal, hover, focus, pressed, and disabled contrast states.

## 3. Windowed Image Viewer and Shared Loading States

- [x] 3.1 Update image-viewer tests for a centered 720×520 normal window, native maximize/restore, disabled minimization, safe close/Escape, and unchanged preview focusability.
- [x] 3.2 Add typed maximize/restore IPC and Rust window logic, change `show_image_viewer` from simple fullscreen to centered normal display, and reset maximized state safely on close.
- [x] 3.3 Add localized maximize/restore controls to the image viewer while keeping aspect-ratio-preserving rendering, loading/error states, duplicate-close protection, and main-window restoration.
- [x] 3.4 Extend shared image loading presentation so normal image details show compact loading/error feedback while main-list and archive thumbnails keep stable row dimensions.

## 4. Verification

- [x] 4.1 Run focused Preferences, theme, and image-viewer Node tests and resolve all regressions.
- [x] 4.2 Follow the session's single-pass Impeccable detector policy and review the final source diff for visual-system drift. The earlier detector pass reported no findings; it was not repeated after implementation because the skill permits only one run. The only intentional exception is adding a restore glyph to the existing project-owned `UiIcons` family instead of adding a new dependency for one icon.
- [x] 4.3 Run `npm run check`, all `tests/*.test.mjs`, `git diff --check`, and strict OpenSpec validation.
- [x] 4.4 Run the Windows Rust target check when the local toolchain supports it and preserve CI/device smoke as the boundary for Windows runtime claims. The local macOS cross-check reached `ring` but could not compile its C source because the MSVC target headers are unavailable (`assert.h` not found), so Windows CI and device smoke remain the release authority.

## 5. Reused Maximized History Detail Follow-up

- [x] 5.1 Update image-viewer regression tests to require direct maximize, complete `HistoryDetailPanel` reuse, a full image history item payload, restore/maximize label switching, retained metadata and delete actions, and a still-visible main window.
- [x] 5.2 Refactor the viewer to render the shared three-part history detail with expanded image presentation while keeping its window controls, deletion, loading/error, and guarded `Escape` behavior.
- [x] 5.3 Change the native viewer lifecycle to establish the centered 720×520 restore frame, open maximized, hide only the preview family, preserve main-window visibility during viewer focus, and refocus main on close.
- [x] 5.4 Run focused viewer tests, `npm run check`, all `tests/*.test.mjs`, `git diff --check`, and strict OpenSpec validation; retain Windows CI/device smoke and macOS visual smoke as explicit boundaries.

## 6. Viewer and Main Window Layering Follow-up

- [x] 6.1 Add regression coverage requiring the visible main window to leave its always-on-top layer while the viewer is open and restore that layer on close or open failure.
- [x] 6.2 Update the native viewer lifecycle so the maximized history detail covers the still-visible main window without changing the existing non-viewer focus-loss dismissal behavior.
- [x] 6.3 Run focused viewer tests, `npm run check`, all `tests/*.test.mjs`, `git diff --check`, and strict OpenSpec validation; keep macOS visual layering and Windows runtime layering as manual/CI boundaries.
