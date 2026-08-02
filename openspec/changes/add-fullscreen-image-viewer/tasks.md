## 1. Window and IPC Foundation

- [x] 1.1 Add the camelCase `ImageViewerPayload` TypeScript contract and typed image-viewer update event in `src/services/ipc/events.ts`, then re-export it through `src/lib/tauri.ts`.
- [x] 1.2 Add typed `show_image_viewer` and `close_image_viewer` command wrappers, implement the Rust commands to place the viewer on the main window's current display before entering fullscreen, and register them in `generate_handler!`.
- [x] 1.3 Predeclare the hidden, focusable `image-viewer` in `src-tauri/tauri.conf.json`, include it in both capability files, route its label in `src/App.tsx`, and document the sixth window in `AGENTS.md`.
- [x] 1.4 Add regression coverage for the new window label, capability membership, command/event names, and the invariant that only `preview` and `preview-detail` are forced non-focusable.

## 2. Image Loading and Fullscreen Surface

- [x] 2.1 Extract the cancellable image base64 loading flow into a typed `useImageDataUrl` hook and keep `ImageThumb` behavior unchanged while adding hook-level success, cancellation, and failure tests.
- [x] 2.2 Implement `FullscreenImageViewer` with theme propagation, a deep neutral media backdrop, aspect-ratio-preserving `object-contain` rendering, a close control, and explicit loading and failure states.
- [x] 2.3 Add guarded close handling for both the close button and `Escape`, including listener cleanup, duplicate-close protection, and a reduced-motion-safe opacity transition.
- [x] 2.4 Add the required semantic Tailwind styles and bilingual viewer labels, loading text, failure text, close label, and fullscreen action label in `src/uiStyles.ts` and `src/i18n.ts`.

## 3. Detail Actions and Preview Lifecycle

- [x] 3.1 Add the project-style diagonal expand icon and a reusable fullscreen image action button with neutral hover, visible focus, tooltip, and accessible name states distinct from the danger-styled delete button.
- [x] 3.2 Compose the fullscreen action immediately before delete in both `HistoryItemPreviewWindow` and `HistoryPreviewDetailWindow`, rendering it only when `item.kind === "image"`.
- [x] 3.3 On fullscreen activation, emit the selected image payload, invalidate pending preview requests, and call the Rust show command so the main window and complete preview family hide before the viewer gains focus.
- [x] 3.4 On viewer close or native close request, exit fullscreen, hide the viewer, restore and focus the main window at its previous position, emit the existing main-window reset event, and do not restore stale item or group previews.

## 4. Verification

- [x] 4.1 Add focused regression tests for image-only action visibility in both detail shells, localized accessibility text, image contain styling, loading/error UI, `Escape`, and stale-preview suppression.
- [ ] 4.2 Run `npm run check`, `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc`, and `git diff --check`; record that the cross-target check does not replace Windows runtime verification.
- [ ] 4.3 Smoke-test on macOS: open fullscreen from a single image detail and a group hover image detail, exit by button and `Escape`, repeat the cycle, verify light/dark/system themes, and confirm no preview reopens over the viewer.
- [ ] 4.4 Verify the Windows fullscreen, focus, restore-position, and keyboard-exit paths in GitHub Actions and on a Windows device before making a cross-platform release claim.
