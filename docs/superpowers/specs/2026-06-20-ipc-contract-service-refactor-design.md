# mclip IPC Contract Service Refactor Design

## Goal

Refactor the first frontend/Rust boundary layer so mclip has a clearer IPC contract, a smaller Tauri bridge surface, and safer room for later React and Rust module splits.

## Scope

This first phase only reorganizes the frontend boundary around existing Tauri commands, events, and window helpers. It does not change command names, Rust command behavior, preview window geometry, clipboard persistence, CLI behavior, app settings semantics, or user-facing UI.

The expected result is a no-behavior-change refactor that makes future work easier:

- Rust keeps owning native/system work: clipboard IO, window positioning, settings persistence, diagnostics, tray, global shortcuts, and file-system safety.
- React keeps owning rendering and user interaction: state derivation, list selection, preview intent, dialogs, and visible feedback.
- TypeScript has an explicit contract surface for every IPC payload currently used by the frontend.
- Components and hooks stop depending on one large all-purpose Tauri module.

## Current Problem

`src/lib/tauri.ts` currently mixes four responsibilities:

- Calling Rust commands through `invoke`.
- Publishing and subscribing to cross-window events.
- Operating Tauri windows directly.
- Providing app helper fallbacks such as version lookup.

That file is already type-safe, but its shape makes it too easy for new UI code to depend on low-level command names, event names, and labels. It also makes future tests awkward because unrelated command/event/window helpers must be imported together.

The frontend state hub, `src/hooks/useClipboardApp.ts`, depends heavily on this mixed bridge. Splitting the bridge first gives the later hook split a stable seam without touching sensitive preview behavior yet.

## Proposed Architecture

Create a small IPC/service layer under `src/services/` and keep `src/lib/tauri.ts` as a temporary compatibility facade during the first phase.

Planned modules:

- `src/services/ipc/commands.ts`
  - Owns typed wrappers around Rust `invoke` calls.
  - Keeps command names private to this module.
  - Exposes domain-oriented command functions such as `getHistory`, `saveSettings`, `showHistoryPreviewWindow`, and `copyDiagnosticReport`.

- `src/services/ipc/events.ts`
  - Owns event names, event emission, and event subscription helpers.
  - Keeps Tauri window labels private unless a caller genuinely needs a label abstraction.

- `src/services/ipc/windows.ts`
  - Owns direct Tauri window APIs: current-window label, hide, drag, and main-window hide.
  - Does not call business commands.

- `src/services/appVersion.ts`
  - Owns `getVersion()` fallback to `DEFAULT_APP_VERSION`.

- `src/lib/tauri.ts`
  - Temporarily re-exports the new service functions so existing call sites can move incrementally.
  - The compatibility facade avoids a risky all-at-once import churn in this phase.

This keeps the first commit mostly mechanical while creating a clean place for later MVVM-style hooks.

## IPC Data Contract

The existing cross-boundary objects remain the canonical contract in `src/types.ts`:

- `AppSettings`
- `CliInstallStatus`
- `AutoPastePermissionStatus`
- `HistoryEntry` and its discriminated variants
- `HistoryPreviewPayload`
- `HistoryPreviewKeyboardNavigationPayload`
- `HistoryPreviewGroupItemActivatedPayload`

This phase will add request/response helper types only where they clarify command arguments or return values. For example, preview placement can keep using `PreviewWindowPosition`, while command argument object shapes can become named TypeScript interfaces when they are shared or complex.

Rust remains the source of truth for serialized field names through `serde(rename_all = "camelCase")`. TypeScript mirrors the serialized shape explicitly. No `any` should be introduced; unknown external values must use `unknown` and be narrowed before use.

## Rust Command Boundary

Rust command names and signatures stay stable in this phase. The frontend wrappers continue to call:

```ts
invoke<AppSettings>("get_settings");
invoke<AppSettings>("save_settings", { settings });
invoke<HistoryEntry[]>("get_history");
invoke<PreviewWindowPosition>("show_history_preview_window", {
  anchorTop,
  previewHeight,
  previewWidth,
  requiredPreviewWidth,
});
```

Rust commands continue returning `Result<T, String>` where they already do. A later Rust-side phase can introduce a structured `AppError` type, but this first phase will not change IPC error serialization because that would affect every frontend caller at once.

## Error Handling

This phase keeps command wrappers promise-based and lets domain hooks decide user-facing recovery. The service layer should not swallow errors except for helpers whose existing contract already has a fallback, such as app version lookup.

Recommended rule:

- Service command functions return the original rejected promise when Rust returns an error.
- Hooks catch command failures and decide whether to log, reset preview state, or show UI feedback.
- Event subscription helpers return `Promise<UnlistenFn>` and do not hide subscription failures.

This preserves existing behavior while making the error boundary explicit.

## Testing and Verification

The refactor should be verified as a no-behavior-change patch.

Fast checks:

```bash
npm run check:frontend
node --test tests/*.test.mjs
git diff --check
```

Full gate before declaring complete:

```bash
npm run check
```

Because this phase does not change Rust behavior, focused Rust tests are not required unless Rust files are touched unexpectedly. If Rust files change, run the relevant Cargo command plus the full gate.

## Rollout Plan

- Create the `src/services/ipc/` modules and move constants plus wrappers from `src/lib/tauri.ts` into focused files.
- Keep `src/lib/tauri.ts` as a re-export facade so call sites continue compiling.
- Run frontend typecheck.
- Move one or two low-risk imports to the new service modules only if it reduces coupling without broad churn.
- Run the full project check before completion.

## Out of Scope

This phase will not:

- Change preview window positioning or dismissal logic.
- Change clipboard history serialization, storage, or file-list semantics.
- Change Tauri capabilities or window labels.
- Change Preferences, About, CLI, or public site behavior.
- Introduce Zustand, React Router, or a new state library.
- Introduce generated bindings between Rust and TypeScript.

Those are later phases once the IPC seam is stable.

## Implementation Decision

Keep the compatibility facade in `src/lib/tauri.ts` for this phase. Existing imports can continue compiling while the underlying command, event, window, and app-version helpers move into focused service modules. Direct call-site import migration should happen only after the service split passes verification.
