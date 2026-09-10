## Purpose

Define a user-configurable pin admission limit shared by desktop and CLI, preserving existing pinned history while providing actionable and accessible desktop failure feedback.

## ADDED Requirements

### Requirement: Configurable pin admission limit
The system SHALL expose `maxPinnedItems` in saved settings with default 10 and integer range 5..=20, independently of ordinary history retention and display counts.

#### Scenario: Missing setting in an existing installation
- **WHEN** valid settings without `maxPinnedItems` are loaded
- **THEN** the effective limit is 10
- **AND** loading alone does not rewrite settings or history.

#### Scenario: Clamp valid integer values
- **WHEN** a saved integer limit is 4 or 21
- **THEN** it is normalized to 5 or 20 respectively
- **AND** desktop and CLI use the same normalized value.

#### Scenario: Immediate preference save
- **WHEN** a user enters a valid integer in the History page pin-limit control
- **THEN** the effective setting is saved through the existing immediate-save workflow
- **AND** subsequent pin operations after successful saving use the new limit
- **AND** a failed save restores the previous effective value and displays save feedback.

#### Scenario: Invalid editing value
- **WHEN** the preference input is empty, fractional, or not numeric
- **THEN** no invalid setting is submitted
- **AND** the control retains or restores a valid value without affecting history.

### Requirement: Shared pin admission enforcement
Every desktop and CLI pin mutation SHALL count all persisted pins, independent of search, kind filters and display limits, and reject a new pin at or above the effective cap with structured current and maximum counts. Unpin and setting an already pinned item to pinned SHALL remain allowed.

#### Scenario: Eleventh default pin
- **GIVEN** 10 distinct entries have been pinned with default settings
- **WHEN** an eleventh distinct entry is pinned
- **THEN** the operation fails with `pinnedHistoryLimitReached`, current 10 and max 10 at the desktop boundary
- **AND** history, pin timestamps, assets and revision remain unchanged.

#### Scenario: Unpin then pin another entry
- **GIVEN** 10 pins and a limit of 10
- **WHEN** one entry is unpinned and a different ordinary entry is pinned
- **THEN** both operations succeed and the final pinned count is 10
- **AND** unpin retains the ordinary retention and asset-cleanup behavior.

#### Scenario: Lower configured admission limit
- **GIVEN** the limit has been saved as 5 and five entries are pinned
- **WHEN** a sixth distinct entry is pinned
- **THEN** it fails with current 5 and max 5 without a mutation.

#### Scenario: Idempotent pin at the limit
- **GIVEN** pinned count is at or above the cap
- **WHEN** an explicitly pinned entry is requested to be pinned again
- **THEN** the operation succeeds without changing pin time or revision.

#### Scenario: Concurrent desktop requests
- **GIVEN** nine pins, a stable limit of 10 and no external writer
- **WHEN** two desktop requests concurrently attempt to pin different ordinary entries
- **THEN** exactly one additional entry becomes pinned
- **AND** the other request reports current 10 and max 10.

### Requirement: Preserve existing pins when the limit decreases
Upgrading and saving a lower cap SHALL NOT implicitly unpin, delete, reorder or truncate existing pinned entries or their referenced assets.

#### Scenario: Lower below the existing count
- **GIVEN** 12 pinned entries and limit 20
- **WHEN** the user saves limit 5
- **THEN** all 12 pins remain and the settings UI explains that existing pins are retained
- **AND** additional pin attempts fail with current 12 and max 5
- **AND** new pins become possible only after the count drops below 5 or the cap is raised above the count.

#### Scenario: Upgrade a legacy full pinned collection
- **GIVEN** a valid old history file contains 100 pinned entries including images
- **WHEN** it is read without a saved pin-limit field, then ordinary history is added or trimmed
- **THEN** the effective admission cap is 10
- **AND** all existing pins, IDs, pin timestamps and referenced image assets remain
- **AND** explicit unpin and deletion remain available.

### Requirement: Accessible localized pin failure feedback
Every desktop pin entry point SHALL catch failed operations and present one non-blocking application Toast on a visible owning surface, with Chinese, English and Japanese messages. Feedback SHALL preserve window focus and expose only stable error codes and bounded counts across windows.

#### Scenario: Preview pin fails
- **WHEN** pinning from an item preview or group detail exceeds the cap
- **THEN** one main-window Toast reports current/max and how to unpin or raise the limit
- **AND** preview windows remain independent and non-focusable
- **AND** no unhandled Promise rejection or false success update occurs.

#### Scenario: Maximized image viewer pin fails
- **WHEN** pinning an image in the maximized viewer exceeds the cap
- **THEN** the visible viewer displays the same localized feedback
- **AND** the hidden or covered main window is not the only notification destination.

#### Scenario: Highest configurable cap reached
- **WHEN** a pin fails with max 20
- **THEN** the message advises unpinning an item
- **AND** does not suggest raising the limit beyond 20.

#### Scenario: Toast lifetime and accessibility
- **WHEN** a failure Toast appears
- **THEN** it is announced through a live region, remains for at least six seconds, wraps within the window and does not move focus
- **AND** repeated errors replace the current Toast instead of forming an unbounded stack
- **AND** delayed feedback never reopens a dismissed window.

#### Scenario: Non-limit failure
- **WHEN** a pin fails due to a persistence or permission error
- **THEN** a localized generic failure is shown without fabricating counts
- **AND** no clipboard content, private paths or raw storage error are exposed in feedback or new diagnostics.
