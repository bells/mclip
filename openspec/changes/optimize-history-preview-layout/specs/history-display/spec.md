## ADDED Requirements

### Requirement: Compact Archive Group Preview Height

The system SHALL size an archive group preview to the rendered height of its header and history rows without reserving unused trailing list space.

#### Scenario: Group rows fit in the available work area

- **WHEN** a user opens an archive group whose rendered rows fit in the current monitor work area
- **THEN** the group preview height matches the rendered group content plus its normal border and padding
- **AND** no extra row-sized blank area appears below the final history item.

#### Scenario: Group rows exceed the available work area

- **WHEN** a user opens an archive group whose natural height exceeds the current monitor work area
- **THEN** the preview window remains fully inside the monitor work area
- **AND** the group header remains visible
- **AND** only the group list region scrolls vertically.

#### Scenario: Rendered group height changes

- **WHEN** the rendered group height changes because its data, theme, font metrics, or available work area changes
- **THEN** the preview updates to the new clamped content height
- **AND** it preserves its alignment with the group row that opened it.
- **AND** it preserves the group's current horizontal family placement so an open detail preview remains on the group's outer side without overlap.

### Requirement: Independent Archive Item Detail Preview

The system SHALL display the active item from an archive group in a separate detail preview window whose size is independent from the archive group list window.

#### Scenario: Pointer activates an archive item

- **WHEN** the pointer hovers an item in an open archive group preview
- **THEN** that row is highlighted
- **AND** a separate detail preview appears adjacent to the group preview
- **AND** the detail content region aligns vertically with the active row when the monitor work area permits
- **AND** the detail and group surfaces meet without a transparent gap
- **AND** the group preview height does not change because the detail opened.

#### Scenario: Keyboard activates an archive item

- **WHEN** keyboard navigation activates an item in an open archive group preview
- **THEN** the same separate detail preview renders that item
- **AND** the detail uses the same structure and dimensions as the item detail opened from the main history list.

#### Scenario: Active archive item changes

- **WHEN** the active archive item changes from one content type or length to another
- **THEN** the detail preview updates to the newly active item
- **AND** its height is recalculated from that item's detail content rules
- **AND** the group preview keeps its own content-driven height.

#### Scenario: Detail does not fit on the preferred side

- **WHEN** the detail preview would cross the monitor work-area boundary on its preferred side
- **THEN** the archive group preview keeps its current position
- **AND** the system places the detail on the archive group's other side when that side fits
- **AND** the detail remains immediately to the left or right of the archive group preview
- **AND** the detail may cover the main window when screen space is constrained
- **AND** the detail and archive group preview never overlap.

#### Scenario: Pointer moves between group and detail windows

- **WHEN** the pointer moves from the archive group preview into its detail preview
- **THEN** both windows remain visible
- **AND** the preview family closes only after the pointer has left both windows according to the existing dismissal delay.

### Requirement: Detail-Owned History Item Deletion

The system SHALL expose deletion of an individual history item from the history detail header rather than from an archive group list row.

#### Scenario: Main history item detail is shown

- **WHEN** a user opens an item detail from the main history list
- **THEN** the detail header contains the delete action
- **AND** the main history row does not contain an inline delete action.

#### Scenario: Archive item detail is shown

- **WHEN** a user activates an item in an archive group preview
- **THEN** the separate detail header contains the same delete action used by the main item detail
- **AND** the archive group row does not contain an inline delete action.

#### Scenario: User deletes an archive item from its detail

- **WHEN** the user invokes the delete action in an archive item detail
- **THEN** the system deletes exactly that history item
- **AND** hides the stale item detail
- **AND** refreshes the main history and open archive group from the persisted history result.

#### Scenario: Deletion empties the archive group

- **WHEN** deleting an item leaves the currently open archive group with no items
- **THEN** the system closes the group and detail preview windows
- **AND** no empty preview surface remains visible.
