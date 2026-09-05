## 1. Native selection
- [x] 1.1 Add official native dialog integration and bounded platform metadata resolution with symmetric IPC types.
- [x] 1.2 Cover cancellation, invalid identity, duplicate handling and platform identifier derivation with focused tests.

## 2. Preferences
- [x] 2.1 Replace identifier entry with an accessible application list and add/remove actions using existing immediate saving.
- [x] 2.2 Add Chinese, English and Japanese copy and update project documentation.

## 3. Verification
- [x] 3.1 Run full checks, frontend regression tests, Windows target check and strict OpenSpec validation.
- [x] 3.2 Verify browser list interaction and local macOS metadata, record native picker and other-platform evidence boundaries.

Task 3.1: Windows x64 all-target checking now passes using cargo-xwin and the downloaded Microsoft SDK/UCRT. The owner reported macOS manual validation was generally successful and will validate Windows in Parallels Desktop later. See `verification.md` for the remaining Windows/Linux runtime evidence boundaries; no archive has been performed.
