## 1. Source and exports

- [x] 1.1 Add real PNG palette/alpha and ICO/ICNS tests; observe the old green identity fail.
- [x] 1.2 Preserve the selected second PNG as the canonical source and add `icons:generate-maple`; verify desktop, template, contrast and website outputs pass the asset tests.
- [x] 1.3 Verify notebook SVG/PNG hashes are unchanged and repeated exports are deterministic.

## 2. Integration and records

- [x] 2.1 Update Chinese/English/Japanese icon labels while retaining all three settings values; verify frontend and localization tests.
- [x] 2.2 Update roadmap and reproduction/provenance documentation; verify links and OpenSpec strict validation.
- [x] 2.3 Inspect real 16/18/22px light/dark previews and the website's current static logo; save visual evidence and observed limitations.

## 3. Verification

- [x] 3.1 Run full local checks and root tests, Windows x64 all-target cross-check, website tests/build, and whitespace checks; record exact results.
- [x] 3.2 Obtain a fresh read-only review of the icon diff and resolve material findings.
- [ ] 3.3 Verify native macOS menu-bar appearance and the three saved choices after a native build.
- [ ] 3.4 Verify Windows and Linux tray appearance in named native sessions.
