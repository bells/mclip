## ADDED Requirements

### Requirement: Appearance Preferences Organization

The system SHALL organize visual preferences on a dedicated Appearance page within the settings center.

#### Scenario: Appearance page order

- **WHEN** the Appearance destination renders
- **THEN** appearance theme and menu bar icon controls appear in an Interface group
- **AND** main-window brand and row-number visibility appear in a Main Window group
- **AND** language, launch at login, and auto paste remain on the General page.

#### Scenario: Appearance setting changes remain immediate

- **WHEN** the user changes theme, menu bar icon, main-window brand, or row-number visibility
- **THEN** the existing immediate apply and save flow runs
- **AND** affected visible windows continue to receive the normalized setting
- **AND** no Save or Cancel action is introduced.

### Requirement: Settings Center Uses mclip Visual Semantics

The system SHALL use mclip's semantic theme system and compact desktop identity throughout the redesigned Preferences surface.

#### Scenario: Light and dark settings center

- **WHEN** Preferences renders in light, dark, or system appearance
- **THEN** sidebar, content, settings rows, controls, focus rings, status, and errors use semantic theme tokens
- **AND** normal text meets WCAG AA contrast
- **AND** active navigation and controls remain distinguishable without relying on color alone.

#### Scenario: Reference products do not replace product identity

- **WHEN** the two-column settings layout renders
- **THEN** it retains mclip's existing cool-neutral, warm metadata, teal interaction, and danger color roles
- **AND** it does not copy ChatGPT or Zero brand colors, oversized spacing, or decorative elements unrelated to clipboard settings.

#### Scenario: Active navigation signature

- **WHEN** a navigation destination is active
- **THEN** it uses a restrained selection surface and a narrow semantic accent rail
- **AND** text and programmatic selected state identify the destination even if the accent color is not perceived.
