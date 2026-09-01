import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTranslationSources } from "./helpers/translations.mjs";

async function readSource(path) {
  return readFile(path, "utf8");
}

test("Linux dependencies select in-process Wayland data-control and XDG autostart", async () => {
  const [cargo, docs] = await Promise.all([
    readSource("src-tauri/Cargo.toml"),
    readSource("docs/linux-support.md"),
  ]);

  assert.match(cargo, /arboard\s*=\s*\{[^}]*features\s*=\s*\["wayland-data-control"\]/);
  assert.match(cargo, /target_os = "linux"[\s\S]*tauri-plugin-autostart/);
  assert.doesNotMatch(cargo, /wl-clipboard|xclip|xsel/);
  assert.match(docs, /must not invoke `wl-copy`, `wl-paste`, `xclip`, or `xsel`/);
  assert.match(docs, /No systemd user service/);
});

test("Linux capability contracts stay symmetric and use stable status values", async () => {
  const [rust, types, commands, facade, app] = await Promise.all([
    readSource("src-tauri/src/desktop_capabilities.rs"),
    readSource("src/types.ts"),
    readSource("src/services/ipc/commands.ts"),
    readSource("src/lib/tauri.ts"),
    readSource("src-tauri/src/lib.rs"),
  ]);

  for (const field of [
    "clipboardHistory",
    "clipboardWrite",
    "trayActivation",
    "globalShortcut",
    "sourceAppDetection",
    "launchAtLogin",
    "autoPaste",
  ]) {
    assert.match(types, new RegExp(`${field}: DesktopCapability`));
  }
  for (const status of ["available", "degraded", "unavailable"]) {
    assert.match(types, new RegExp(`\\| "${status}"`));
  }
  assert.match(rust, /pub enum DesktopCapabilityStatus[\s\S]*Available[\s\S]*Degraded[\s\S]*Unavailable/);
  assert.match(commands, /invoke<DesktopCapabilities>\("get_desktop_capabilities"\)/);
  assert.match(facade, /export \* from "\.\.\/services\/ipc\/commands"/);
  assert.match(app, /get_desktop_capabilities/);
});

test("Linux runtime uses one bounded broker and never shells out for clipboard access", async () => {
  const source = await readSource("src-tauri/src/clipboard.rs");

  assert.match(source, /sync_channel\(LINUX_CLIPBOARD_REQUEST_CAPACITY\)/);
  assert.match(source, /recv_timeout\(LINUX_CLIPBOARD_RESPONSE_TIMEOUT\)/);
  assert.match(source, /struct LinuxClipboardBroker/);
  assert.match(source, /LinuxClipboardRequest::Shutdown/);
  assert.match(
    source,
    /\.set\(\)[\s\S]*\.wait_until\([\s\S]*LINUX_CLI_OWNERSHIP_HANDOFF_TIMEOUT[\s\S]*\.text\(text\)/,
  );
  assert.doesNotMatch(source, /Command::new\(["'](?:wl-copy|wl-paste|xclip|xsel)["']\)/);
});

test("Linux Preferences capability status extends the current Settings Center", async () => {
  const [windowSource, navigationSource, i18nSource] = await Promise.all([
    readSource("src/components/PreferencesWindow.tsx"),
    readSource("src/components/preferences/preferencesNavigation.ts"),
    readTranslationSources(),
  ]);

  assert.match(windowSource, /<PreferencesSettingsCenter/);
  assert.match(windowSource, /getDesktopCapabilities/);
  assert.match(windowSource, /desktopCapabilitiesGroupLabel/);
  assert.match(navigationSource, /general\.desktop-capabilities/);
  assert.match(i18nSource, /linuxWaylandClipboardUnavailable/);
  assert.match(i18nSource, /Linux clipboard access is unavailable/);
  assert.match(i18nSource, /Linux 剪贴板访问不可用/);
});

test("Linux CI, bundles, Release assets, and installer mappings are explicit", async () => {
  const [ci, release, config, installer] = await Promise.all([
    readSource(".github/workflows/ci.yml"),
    readSource(".github/workflows/release.yml"),
    readSource("src-tauri/tauri.linux.conf.json"),
    readSource("install.sh"),
  ]);

  assert.match(ci, /ubuntu-24\.04/);
  assert.match(ci, /libwebkit2gtk-4\.1-dev/);
  assert.match(ci, /node --test tests\/\*\.test\.mjs/);
  assert.match(ci, /pnpm run tauri:build --bundles deb,appimage/);
  assert.doesNotMatch(ci, /pnpm run tauri:build -- --bundles/);
  assert.deepEqual(JSON.parse(config).bundle.targets, ["deb", "appimage"]);
  assert.match(release, /mclip-cli-linux-x64/);
  assert.match(release, /mclip-cli-linux-x64\.sha256/);
  assert.match(release, /\*\.AppImage/);
  assert.match(release, /\*\.deb/);
  assert.match(installer, /Linux:x86_64\|Linux:amd64\) printf 'mclip-cli-linux-x64'/);
});
