## ADDED Requirements

### Requirement: First-class Japanese public routes
The mclip website SHALL publish Japanese as a first-class static locale with a localized homepage at `/ja/` and localized changelog at `/ja/changelog/`.

#### Scenario: Visit the Japanese homepage
- **WHEN** a user opens `/ja/`
- **THEN** the page presents the current product promise, supported platforms, core clipboard workflow, Agent/CLI workflow, installation guidance, and trust limitations in Japanese
- **AND** product names, commands, URLs, version numbers, and platform names remain technically exact.

#### Scenario: Visit the Japanese changelog
- **WHEN** a user opens `/ja/changelog/`
- **THEN** the page presents the same released-version scope and material security, privacy, signing, and compatibility caveats as the Chinese and English changelogs
- **AND** the Japanese claims do not overstate in-development features as released behavior.

#### Scenario: Generate the static website
- **WHEN** Astro builds the production site
- **THEN** both Japanese routes are emitted as static pages
- **AND** they are discoverable by the generated sitemap together with the Chinese and English equivalents.

### Requirement: Three-language navigation
Every localized homepage and changelog SHALL expose a shared language control for Chinese, English, and Japanese that links to the equivalent page kind in each locale.

#### Scenario: Switch language from a homepage
- **GIVEN** the user is on any localized homepage
- **WHEN** the user chooses Chinese, English, or Japanese
- **THEN** navigation targets `/zh/`, `/en/`, or `/ja/` respectively
- **AND** the active language is identified accessibly without hiding the other two choices.

#### Scenario: Switch language from a changelog
- **GIVEN** the user is on any localized changelog
- **WHEN** the user chooses another language
- **THEN** navigation targets the corresponding `/<locale>/changelog/` page
- **AND** it does not send the user back to that locale's homepage.

#### Scenario: Use navigation on a narrow viewport
- **WHEN** the three-language control renders on a narrow website viewport
- **THEN** all three language choices remain readable and operable
- **AND** the primary product navigation does not overflow horizontally.

### Requirement: Complete multilingual discovery metadata
Each localized website page SHALL publish self-consistent canonical, language-alternate, social, and structured metadata for Chinese, English, and Japanese.

#### Scenario: Publish language alternates
- **GIVEN** a Chinese, English, or Japanese home or changelog page
- **WHEN** its document head is rendered
- **THEN** its canonical URL points to that localized page
- **AND** `hreflang` alternates point to equivalent `zh-CN`, `en`, and `ja` routes
- **AND** `x-default` points to the equivalent English route.

#### Scenario: Publish Japanese document and social locale
- **GIVEN** the current page is Japanese
- **WHEN** metadata is rendered
- **THEN** the HTML language and page `inLanguage` are `ja`
- **AND** the Open Graph locale is `ja_JP`
- **AND** Chinese and English Open Graph locale alternatives are present.

#### Scenario: Publish site-wide structured languages
- **WHEN** JSON-LD is rendered for any localized page
- **THEN** the WebSite entity declares `zh-CN`, `en`, and `ja`
- **AND** page, software, video, and FAQ language fields use the current locale where applicable
- **AND** Japanese descriptions and image/video accessible text are used on Japanese pages.

### Requirement: Stable default routing
Adding Japanese SHALL preserve English as the stable default route rather than introducing implicit browser-language negotiation.

#### Scenario: Open the root URL
- **WHEN** a user requests `/`
- **THEN** the edge returns the existing temporary redirect to `/en/`
- **AND** no client-side temporary homepage or locale-detection script is required.

#### Scenario: Resolve x-default
- **WHEN** a crawler follows the `x-default` alternate for a home or changelog page
- **THEN** it reaches the equivalent English route
- **AND** the Japanese addition does not change established English canonical URLs.

### Requirement: Public language facts and content parity
Public machine-readable facts and website regression checks SHALL identify Japanese support and SHALL keep material product claims aligned across all three localized pages.

#### Scenario: Read public product facts
- **WHEN** a client reads `llms.txt`
- **THEN** it finds the Japanese homepage and changelog URLs
- **AND** the interface-language fact identifies Chinese, English, and Japanese
- **AND** Follow System behavior states that `ja` locales resolve to Japanese and unsupported locales fall back to English.

#### Scenario: Run multilingual content tests
- **WHEN** website content tests run
- **THEN** they load all six localized home/changelog files
- **AND** verify the current version, macOS and Windows support, installation safety, privacy/masking boundaries, signing limitations, and file-history semantics in each language
- **AND** verify three-way navigation, canonical URLs, alternates, Open Graph locale data, JSON-LD languages, static-route output, and the unchanged root redirect.

#### Scenario: Keep CLI localization out of scope
- **GIVEN** Japanese language support is advertised
- **WHEN** public copy describes `mclip-cli`
- **THEN** it does not claim Japanese CLI help or output
- **AND** existing command names and output contracts remain unchanged.
