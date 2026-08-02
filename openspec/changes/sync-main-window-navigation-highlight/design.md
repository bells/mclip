## Context

The main window already linearizes search, visible history rows, archive group rows, and enabled footer actions through `MainKeyboardNavigationTarget` values and `data-main-keyboard-target` markers. `App.tsx` also stores the last keyboard target, while individual components combine focus callbacks, mouse-enter callbacks, preview state, and CSS hover selectors to decide what looks active. Because those paths are named and styled around their input source, logical selection, DOM focus, hover, and preview activation can disagree.

The change is frontend-only. The main Tauri window remains the keyboard owner, while `preview` and `preview-detail` remain separate and non-focusable. Existing visible-order traversal, wrap behavior, preview positioning, and scroll-into-view behavior must remain intact.

## Goals / Non-Goals

**Goals:**

- Represent the main window's highlighted search/control/row with one canonical active-target state.
- Activate search by default on initial mount and every main-window show event.
- Make Arrow Up/Arrow Down and pointer movement update the same state.
- Continue keyboard traversal from the target most recently activated by the pointer.
- Keep the active target's preview and scroll behavior synchronized.
- Preserve accessible DOM focus without allowing focus-only styles to look like a second selected target.

**Non-Goals:**

- Changing the visible target order, arrow-key wrap rules, Enter/Delete semantics, or archive-preview left/right navigation.
- Moving keyboard focus into either preview window or changing the six-window model.
- Changing history persistence, settings, IPC payloads, Rust commands, or Tauri capabilities.
- Adding pointer selection to disabled controls or activating an item merely because layout changes beneath a stationary pointer.

## Decisions

### 1. Rename and generalize the existing target state into the sole active-target model

`MainWindow` will own one active target ID plus a synchronized ref for native event callbacks. Search, history rows, archive groups, and enabled footer actions will derive their selected appearance from that value. Component callbacks will report target activation without maintaining a second hover-selected or preview-selected state.

This extends the existing serialized-target model instead of adding a separate pointer-selection store. A second store would require precedence rules and is the source of the current divergence.

### 2. Keep logical activation separate from forced DOM focus

Keyboard navigation will continue to focus the target element and call `scrollIntoView({ block: "nearest" })`. Pointer movement will update the canonical active target and associated preview behavior without forcing focus on every hovered control. This avoids stealing text-editing focus or generating excessive accessibility announcements while the pointer crosses rows.

Search and control styles will derive their visible activation from the canonical selected surface. Raw `:focus` styling must not continue to present search as the selected target after pointer activation moves elsewhere. Search keeps a visible accent border and selected surface, while history rows, archive groups, and footer actions keep their selected background and inset border; none of these targets adds a second outer ring.

For pointer takeover, activation will be driven by actual pointer movement over a navigable target. It will not infer a new active target solely from a rerender beneath an unmoved pointer.

### 3. Reuse visible-order navigation and make the latest active target its input

Arrow Up and Arrow Down will continue to call the pure target-order helpers in `src/utils/keyboardNavigation.ts`. The current target argument will always come from the canonical active-target ref first, including after pointer activation. Invalid or no-longer-rendered targets will reconcile to search before further navigation rather than leaving an invisible selection.

This preserves the tested order and wrap behavior while making pointer-to-keyboard handoff deterministic.

### 4. Derive previews from active-target transitions without changing window ownership

Activating a history row opens its item preview; activating an archive group opens its group preview; activating search or a footer action dismisses stale preview state. The existing preview keyboard event channel remains responsible for navigation inside a group preview, and the preview windows remain non-focusable.

The active highlight is not derived from `previewHistoryGroupIndex`; instead, both active styling and preview updates are consequences of the same target activation. This avoids a preview request or delayed close becoming a competing selection source.

### 5. Test the pure transition rules and the component wiring seam

Focused tests will cover default search activation, visible-order traversal, pointer takeover, keyboard continuation from a pointer-activated target, invalid-target reconciliation, and one-active-target styling contracts. Existing keyboard, preview dismissal, and listener lifecycle tests remain regression gates.

Pure helpers are preferred for transition decisions. Source-level component tests may continue where the current test suite intentionally verifies React wiring without a browser runtime.

## Risks / Trade-offs

- [DOM focus can remain on search after pointer activation moves elsewhere] → Make selected styling depend on the canonical active target and use the selected border/surface as the focus affordance without an outer ring.
- [High-frequency pointer movement can cause redundant renders or preview requests] → Ignore activation when the reported target is already active and preserve existing preview request/revision guards.
- [History/filter updates can invalidate an index-based target] → Validate the active target against the current rendered target list and reset to search when it is no longer valid.
- [Changing shared row styles can regress delete affordances or theme contrast] → Reuse existing selection tokens and run focused keyboard/style tests plus the full frontend and repository checks.

## Migration Plan

1. Add or extend pure active-target transition helpers and regression tests.
2. Refactor `MainWindow` state and callbacks to use the canonical active target.
3. Wire search, history rows, archive groups, and footer actions to report pointer/focus activation consistently.
4. Make each surface derive selected styling from the canonical target and verify preview synchronization.
5. Run focused JS tests, `npm run check`, and `git diff --check`.

The change has no persisted-data migration. Rollback is limited to reverting the frontend and test changes.

## Open Questions

None. Existing target order, wrapping, preview placement, and non-focusable-window constraints define the remaining behavior.
