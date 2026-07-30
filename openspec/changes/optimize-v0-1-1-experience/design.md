## Context

The main window renders the first history group as rows and later groups through `HistoryGroupNav`. Archive rows are already a usable 34px high, but `ui.archiveList` adds a 4px `gap-1` between every row, making a utility window with several groups feel loose. Preview positioning depends on each button's measured top edge, so compacting the layout must not change the separate-window preview model or pointer behavior.

The Preferences General tab currently uses a three-column card grid. Language and Appearance Theme are selects stacked below their labels, while Menu Bar Icon uses a three-button radio group with image previews. The requested interaction keeps all three fields in one horizontal row while placing each field's label and compact selector side by side, with immediate persistence through the existing typed setting handlers. Menu Bar Icon choices must remain visual: its collapsed control and dropdown options show the actual icon images without visible option text.

`mclip-cli --version` is already implemented and was verified locally to print `mclip-cli 0.1.1` with exit status `0`. The installation failure has a different cause. The latest public Release is still `v0.1.0`, which has no CLI assets; draft `v0.1.1` has the two CLI binaries but currently exposes no `.sha256` companions. `install.sh` intends to fall back on a 404, but only does so when curl exits with code 22. The reported environment returned final HTTP 404 with curl code 56, so the script treated a known missing asset as a fatal transport failure.

This change overlaps the release-distribution area of `add-cli-version-and-update-management`. Implementation should preserve that change's checksum and recoverable-replacement contract, and should reconcile overlapping tasks/specs rather than restoring any unverified binary path.

## Goals / Non-Goals

**Goals:**

- Make archive/history group navigation visually tighter without shrinking its click target or changing preview interaction.
- Present Language, Appearance Theme, and Menu Bar Icon in one horizontal three-column strip, with each column using an inline label/selector pair.
- Keep the language and theme selects compact, and show menu bar icon choices as images rather than visible text.
- Keep the current settings data model, values, immediate-save behavior, and bilingual option labels.
- Keep `mclip-cli --version` history-independent and protected by an explicit real-binary regression test.
- Distinguish a completed HTTP 404 response from an actual transport failure and reliably use the source-build fallback for a missing prebuilt asset.
- Prevent a green release workflow from representing a CLI release whose required binary/checksum asset set is incomplete.
- Provide an explicit readiness check for the currently incomplete v0.1.1 draft before it is published.

**Non-Goals:**

- Changing history grouping, counts, stored settings, IPC field names, or preview-window ownership.
- Adding a new CLI version flag, changing the version output format, or adding CLI self-update.
- Installing an unverified downloaded binary when its checksum is missing.
- Publishing the v0.1.1 draft, moving its tag, or mutating remote Release assets as an implicit part of applying source changes.
- Adding new UI or installer dependencies.

## Decisions

### 1. Remove inter-row gap while preserving archive row geometry

Change the archive group list from `gap-1` to no inter-row gap (or an equivalent compact token) and retain the existing 34px archive button height, padding, focus ring, and rounded hover/active treatment. This directly addresses excess vertical whitespace while keeping pointer and touch targets stable. Preview anchors continue to come from `getBoundingClientRect().top`, so no position calculation or Rust window change is needed.

Shrinking the entire row height was considered, but it would reduce the interaction target and could make group ranges harder to scan. Changing main history row padding was also considered, but those rows are already adjacent; the visible excess is in archive group navigation.

### 2. Use one three-column strip with compact inline selectors

Keep `settingsPrimaryGrid` as a three-column horizontal grid and render each field as a compact two-column pair: a content-sized label followed by a short selector. Increase the fixed Preferences width from 460px to 760px so Language, Appearance Theme, and Menu Bar Icon all fit in one row without truncating English labels. Each field uses a real `<label>` associated with its control through `htmlFor`/`id`, while retaining an accessible name.

Language continues to write `AppLanguage`, Appearance Theme continues to write `AppearanceTheme`, and Menu Bar Icon writes `MenuBarIconStyle`. Language and Appearance Theme remain compact native selects. Because native `<option>` elements cannot reliably render images across macOS and Windows, Menu Bar Icon uses a small custom dropdown: the trigger shows the current image, the listbox shows image-only options for `appIcon`, `light`, and `m`, and localized text remains available through accessible labels and tooltips. The dropdown supports pointer selection, Escape, arrow keys, Home/End, focus return, and outside-click dismissal. No Rust, IPC, serialization, or setting normalization change is required.

The dropdown must not close synchronously from the wrapper's `blur` event. WebKit can report a null `relatedTarget` while focus moves between option buttons, which would unmount the list before the subsequent click can commit `menuBarIconStyle`. Dismissal instead observes document-level `focusin` and pointer events whose targets are outside the dropdown. Escape stops propagation so it closes the dropdown and restores trigger focus without also reaching the Preferences window's Escape-to-close handler.

Keeping the 460px window and compressing three inline pairs was considered, but it leaves too little width for English labels and meaningful select values. Keeping the image radio group was also rejected because it does not behave like a compact selection box. A native menu bar select was rejected because native options do not provide dependable image rendering across the target platforms.

### 3. Treat final HTTP status independently from curl's transport exit code

The installer download helper will capture curl's final HTTP status without relying on `--fail` to classify application-level responses:

- final 2xx response with successful transfer: continue to checksum download and verification;
- final 404 response: remove/ignore the response body and return the existing source-fallback signal;
- other HTTP response: fail with an actionable HTTP error;
- no trustworthy final HTTP response or interrupted transfer: fail as a transport error and preserve the existing CLI.

The checksum request remains fail-closed: a binary that exists without a valid checksum must not fall back to installing that binary or replace the destination. Pinned `MCLIP_VERSION` requests follow the same classification and never substitute another Release version.

Merely accepting curl code 56 whenever `%{http_code}` happens to be 404 was considered, but explicit status-based classification is easier to test and avoids encoding proxy/HTTP-version-specific curl behavior.

### 4. Make release completeness a separate, observable gate

The Release workflow will verify locally that each expected binary and `.sha256` file exists and that the checksum validates before upload. Upload steps will fail on unmatched paths. After all platform jobs complete, a release-readiness job will query the tag's draft Release and assert the complete expected asset set:

- `mclip-cli-darwin-arm64`
- `mclip-cli-darwin-arm64.sha256`
- `mclip-cli-windows-x64.exe`
- `mclip-cli-windows-x64.exe.sha256`

The readiness job also verifies that the checksum assets are non-empty and correspond to their named binaries where authenticated download is available. A missing asset makes the workflow fail and blocks manual publication; it does not silently publish or repair a Release.

Moving all desktop and CLI uploads into one aggregation job would reduce concurrent Release mutation, but is a larger workflow rewrite. The explicit post-matrix gate provides a focused fix and evidence while preserving the current Tauri build matrix.

### 5. Separate source correctness from current v0.1.1 Release remediation

Applying this change fixes future scripts/workflows and adds a command/checklist to audit a draft Release. The existing v0.1.1 draft must then be repaired deliberately: generate checksums from the exact draft binaries or rerun a trusted build for the unchanged tag, upload the two companion assets, rerun the readiness check, and only then publish.

If rebuilding would require moving the existing `v0.1.1` tag to a different commit, implementation must stop and request explicit authorization. Source changes alone must not claim that the public one-command install is fixed until the website script is deployed and the target Release state passes the live readiness check.

## Risks / Trade-offs

- [Risk] Removing group gaps could make adjacent active/hover surfaces visually merge. → Keep each row's rounded state styling and verify multiple consecutive groups in both themes.
- [Risk] Native select rendering varies between macOS and Windows, and the image dropdown adds custom keyboard behavior. → Reuse the existing `settingsSelect` styling, keep the custom control narrow, and verify focus, dismissal, and option navigation.
- [Risk] WebView focus transitions can report no `blur.relatedTarget`, dropping an option click if blur immediately unmounts the list. → Keep the list mounted through internal focus changes and dismiss only after document focus/pointer movement is confirmed outside.
- [Risk] An error page may leave bytes at the temporary download path. → Treat only successful 2xx transfers as binaries and clean the temporary directory on every fallback/failure path.
- [Risk] A 404 can mean the whole Release is not public, not just one missing file. → Report the missing published asset and use source fallback only when prerequisites exist; pinned versions remain pinned.
- [Risk] The workflow may upload assets successfully but a concurrent matrix job may still alter the same draft. → Run the completeness assertion only after all matrix jobs finish.
- [Trade-off] Public installs can still require Git and Cargo while the latest published Release lacks prebuilt CLI assets. This is slower but preferable to either a hard failure or an unverified binary.
- [Trade-off] The post-upload gate detects an incomplete draft but does not automatically repair it; publication remains an explicit release-owner action.

## Migration Plan

1. Compact the archive group CSS and verify pointer, focus, keyboard, and preview anchoring behavior.
2. Convert the three General fields to one shared three-column strip with compact inline selectors, using an accessible image-only dropdown for Menu Bar Icon.
3. Add/retain real-binary coverage for `--version`, `-V`, and `version` without a history file.
4. Refactor installer response classification, add fixture-server tests for 2xx, 404, non-404 HTTP errors, transport failures, missing checksums, and exact-version pinning, then copy the script byte-for-byte to `site/public/install.sh`.
5. Add local asset/checksum assertions and the post-matrix remote asset completeness gate to the Release workflow.
6. Run repository, site, installer, YAML, and strict OpenSpec checks.
7. As a separately authorized release operation, repair and verify the current v0.1.1 draft assets, deploy the updated public script, and run a live macOS install smoke before publication.

Rollback can restore the prior layout classes and installer script while leaving settings/history data untouched. Release assets and publication state require a separate explicit rollback plan because they are external state.

## Open Questions

None for source implementation. Publishing or rebuilding the existing v0.1.1 draft remains an explicit release-owner decision and is intentionally outside automatic apply behavior.
