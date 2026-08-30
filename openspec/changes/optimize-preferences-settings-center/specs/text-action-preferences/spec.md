## ADDED Requirements

### Requirement: Text Action Preference Contract

The system SHALL persist independent desktop visibility preferences for JSON, Base64, and URL component text-action groups.

#### Scenario: New installation defaults

- **GIVEN** no saved text-action preferences exist
- **WHEN** settings are loaded
- **THEN** JSON, Base64, and URL component groups are all enabled.

#### Scenario: Legacy settings file

- **GIVEN** an existing settings file does not contain `textQuickActions`
- **WHEN** frontend and backend settings are normalized
- **THEN** all three groups are enabled in memory
- **AND** existing settings remain otherwise unchanged
- **AND** loading alone does not require a settings-file rewrite.

#### Scenario: Cross-boundary shape

- **WHEN** text-action preferences cross the Rust and TypeScript boundary
- **THEN** both sides expose boolean `json`, `base64`, and `urlComponent` fields under `textQuickActions`
- **AND** serialization uses the existing camelCase settings contract.

### Requirement: Desktop Text Actions Respect Enabled Groups

The system SHALL only present applicable desktop text actions whose group is enabled.

#### Scenario: JSON group disabled

- **GIVEN** `textQuickActions.json` is `false`
- **WHEN** a valid JSON text detail renders
- **THEN** JSON prettify and JSON minify are not offered
- **AND** enabled applicable Base64 or URL component actions remain available.

#### Scenario: Base64 group disabled

- **GIVEN** `textQuickActions.base64` is `false`
- **WHEN** a text detail renders
- **THEN** Base64 encode and Base64 decode are not offered.

#### Scenario: URL component group disabled

- **GIVEN** `textQuickActions.urlComponent` is `false`
- **WHEN** a text detail renders
- **THEN** URL component encode and URL component decode are not offered.

#### Scenario: All groups disabled

- **GIVEN** all text-action groups are disabled
- **WHEN** a text detail renders
- **THEN** no desktop text-action section is shown
- **AND** no applicability request is started solely for that hidden section.

#### Scenario: Enabled action remains applicability-gated

- **GIVEN** a text-action group is enabled
- **WHEN** the current text does not satisfy an action's existing applicability rule
- **THEN** that action is not offered
- **AND** enabling a group does not force a transformation to run.

### Requirement: Text Action Preferences Preserve Safety Boundaries

Text-action preferences SHALL control desktop presentation only and SHALL NOT weaken existing content, mutation, or CLI boundaries.

#### Scenario: Sensitive text remains masked

- **GIVEN** a classified sensitive text item is masked
- **AND** one or more text-action groups are enabled
- **WHEN** its detail renders
- **THEN** no text action receives or transforms the hidden original content
- **AND** actions become eligible only after the existing explicit reveal flow succeeds.

#### Scenario: Desktop action runs

- **WHEN** an enabled applicable desktop text action runs
- **THEN** it retains the existing bounded Rust transformation contract
- **AND** output remains in memory until the user copies or explicitly confirms replacement
- **AND** preference state is not included in content-bearing logs.

#### Scenario: CLI transform remains available

- **GIVEN** any desktop text-action group is disabled
- **WHEN** the user invokes the CLI `transform` command explicitly
- **THEN** supported transformations remain available
- **AND** CLI help, byte limits, typed errors, and no-history-read behavior remain unchanged.

### Requirement: Text Action Preferences Reach Every Desktop Detail Path

The system SHALL apply the current text-action settings consistently to every desktop history detail surface.

#### Scenario: Single item preview

- **WHEN** a text item preview opens
- **THEN** its typed payload includes the current text-action settings
- **AND** rendered actions respect those settings.

#### Scenario: Group item detail

- **WHEN** a text item is activated inside an archive group preview
- **THEN** the derived preview-detail payload preserves the current text-action settings
- **AND** rendered actions match the single-item preview behavior.
