## ADDED Requirements

### Requirement: Symmetric supported-language contract
mclip SHALL support `system`, `zhCn`, `en`, and `ja` as application-language settings, with the same serialized values and resolved-language meanings in Rust and TypeScript.

#### Scenario: Select Japanese explicitly
- **GIVEN** Preferences is showing the language control
- **WHEN** the user selects Japanese
- **THEN** mclip immediately persists `language` as `ja`
- **AND** the TypeScript and Rust settings representations deserialize it as Japanese.

#### Scenario: Preserve existing explicit languages
- **GIVEN** saved settings contain `zhCn` or `en`
- **WHEN** the Japanese-capable version loads the settings
- **THEN** the saved explicit language remains unchanged
- **AND** unrelated settings retain their saved values.

#### Scenario: Normalize an unknown persisted language
- **GIVEN** saved settings contain an unsupported language identifier
- **WHEN** settings are normalized or deserialized
- **THEN** mclip resolves the language setting to `system`
- **AND** it does not discard otherwise valid unrelated settings solely because of the language value.

### Requirement: Deterministic system-locale resolution
mclip SHALL resolve the `system` language setting consistently in the frontend and Rust, using Chinese for `zh` locales, Japanese for `ja` locales, and English for all other locales.

#### Scenario: Japanese system locale
- **GIVEN** the operating-system locale is `ja`, `ja-JP`, or another normalized locale beginning with `ja`
- **WHEN** the saved application language is `system`
- **THEN** both the frontend and Rust resolve the display language to Japanese.

#### Scenario: Existing Chinese system locale
- **GIVEN** the operating-system locale begins with `zh`
- **WHEN** the saved application language is `system`
- **THEN** both the frontend and Rust resolve the display language to Simplified Chinese.

#### Scenario: Unsupported system locale
- **GIVEN** the operating-system locale begins with neither `zh` nor `ja`
- **WHEN** the saved application language is `system`
- **THEN** both the frontend and Rust resolve the display language to English.

#### Scenario: Explicit language overrides the system locale
- **GIVEN** the operating-system locale resolves to one supported language
- **WHEN** the user has explicitly selected `zhCn`, `en`, or `ja`
- **THEN** mclip uses the explicit language in every window and native language-aware surface.

### Requirement: Complete Japanese desktop presentation
mclip SHALL provide a complete parity-checked Japanese translation catalog for all existing desktop UI text and Japanese variants for all existing native messages that are selected through the application-language setting.

#### Scenario: Render every desktop window in Japanese
- **GIVEN** the resolved application language is Japanese
- **WHEN** the user opens the main, preview, preview-detail, image-viewer, About, quick-action, and Preferences windows or a shared modal
- **THEN** all application-owned labels, descriptions, feedback, accessible names, window controls, and error messages are Japanese
- **AND** product names, command names, standard technical tokens, user clipboard content, file paths, and source-application names remain exact rather than being translated.

#### Scenario: Render native language-aware messages in Japanese
- **GIVEN** the resolved application language is Japanese
- **WHEN** mclip creates the tray tooltip or returns an existing localized history command error
- **THEN** the user-facing native message is Japanese
- **AND** the message exposes no clipboard content beyond the existing error contract.

#### Scenario: Compile a complete translation catalog
- **WHEN** the frontend production build type-checks every language dictionary
- **THEN** Japanese, Chinese, and English are each required to implement the same nested keys and translation callback signatures
- **AND** a missing or incompatible Japanese translation fails the build.

#### Scenario: Defensive translation fallback
- **GIVEN** an unexpected runtime language value reaches the frontend translation lookup despite settings normalization
- **WHEN** the lookup cannot select a supported catalog
- **THEN** it returns the complete English catalog
- **AND** it does not render raw translation keys or crash a window.

### Requirement: Immediate cross-window language propagation
Changing the application language SHALL continue to use the existing immediate-save settings flow and SHALL update active and subsequently opened windows without restarting mclip.

#### Scenario: Change from English to Japanese
- **GIVEN** one or more mclip windows are open in English
- **WHEN** the user selects Japanese in Preferences
- **THEN** the setting is saved immediately without a Save or Cancel footer
- **AND** active language-aware windows update through the existing settings flow
- **AND** auxiliary windows opened afterward receive `ja` in their typed payloads and render Japanese.

#### Scenario: Follow System resolves to Japanese
- **GIVEN** the operating-system locale is Japanese
- **WHEN** the user selects Follow System
- **THEN** all language-aware application windows and native surfaces resolve Japanese
- **AND** the persisted setting remains `system` rather than being rewritten to `ja`.

### Requirement: Locale-correct formatting without content mutation
Language-sensitive desktop formatting SHALL use an exhaustive locale mapping of `zhCn` to `zh-CN`, `en` to `en-US`, and `ja` to `ja-JP`, without modifying canonical clipboard or history values.

#### Scenario: Format Japanese history metadata
- **GIVEN** the resolved language is Japanese
- **WHEN** history timestamps or language-sensitive numeric metadata are displayed
- **THEN** `Intl` formatting uses `ja-JP`
- **AND** the underlying timestamps and numeric values remain unchanged.

#### Scenario: Preserve copied content across a language change
- **GIVEN** an entry contains text, an image, or a system file list
- **WHEN** the display language changes to or from Japanese and the entry is copied
- **THEN** mclip writes the same canonical entry content it would have written before the language change
- **AND** only application-owned presentation text and formatting change.

### Requirement: Japanese desktop localization verification
The Japanese desktop language SHALL be protected by automated contract checks and an all-window runtime smoke protocol with explicit platform boundaries.

#### Scenario: Run automated language gates
- **WHEN** repository checks run for the localization change
- **THEN** TypeScript tests cover system and explicit Japanese resolution, settings normalization, dictionary parity, and Japanese locale mapping
- **AND** Rust tests cover `ja` serialization, Japanese system resolution, explicit resolution, unknown-language fallback, and Japanese native-message selection.

#### Scenario: Inspect compact Japanese windows on macOS
- **WHEN** the Japanese runtime smoke is performed on macOS
- **THEN** each Tauri window family is inspected for untranslated application copy, clipping, overflow, focus/lifecycle regressions, and immediate language propagation
- **AND** the result is recorded as macOS evidence only, not as proof of Windows runtime behavior.
