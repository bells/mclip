import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function readSource(path) {
  return readFile(path, "utf8");
}

async function importTypeScriptModule(path) {
  const source = await readSource(path);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("text quick action settings have symmetric defaults and nested normalization", async () => {
  const [types, constants, normalize, rustSettings] = await Promise.all([
    readSource("src/types.ts"),
    readSource("src/constants.ts"),
    readSource("src/utils/settings.ts"),
    readSource("src-tauri/src/settings.rs"),
  ]);

  assert.match(types, /export type TextQuickActionSettings = \{[\s\S]*json: boolean;[\s\S]*base64: boolean;[\s\S]*urlComponent: boolean;/);
  assert.match(types, /textQuickActions: TextQuickActionSettings/);
  assert.match(constants, /textQuickActions:\s*\{[\s\S]*json: true,[\s\S]*base64: true,[\s\S]*urlComponent: true/);
  assert.match(normalize, /settings\.textQuickActions\?\.json !== false/);
  assert.match(normalize, /settings\.textQuickActions\?\.base64 !== false/);
  assert.match(normalize, /settings\.textQuickActions\?\.urlComponent !== false/);
  assert.match(rustSettings, /pub struct TextQuickActionSettings/);
  assert.match(rustSettings, /pub text_quick_actions: TextQuickActionSettings/);
  assert.match(rustSettings, /value\["textQuickActions"\]\["urlComponent"\]/);
});

test("preferences metadata keeps stable grouped destinations and searchable private-safe descriptors", async () => {
  const navigation = await importTypeScriptModule(
    "src/components/preferences/preferencesNavigation.ts",
  );
  const copy = {
    generalTab: "General",
    generalPageDescription: "Startup and language",
    appearanceTab: "Appearance",
    appearancePageDescription: "Theme and window presentation",
    historyTab: "History",
    historyPageDescription: "Saved clipboard history",
    privacyTab: "Privacy",
    privacyPageDescription: "Sensitive content and ignored apps",
    textActionsTab: "Text Actions",
    textActionsPageDescription: "Local text transformations",
    cliTab: "Agent CLI",
    cliPageDescription: "Terminal access",
  };
  const proxy = new Proxy(copy, {
    get(target, key) {
      return target[key] ?? String(key);
    },
  });
  const destinations = navigation.createPreferencesDestinations((key) => proxy[key]);
  const settings = navigation.createPreferenceSettingIndex(
    destinations,
    (key) => proxy[key],
  );

  assert.deepEqual(
    destinations.map(({ id, group }) => [id, group]),
    [
      ["general", "mclip"],
      ["appearance", "mclip"],
      ["history", "mclip"],
      ["privacy", "mclip"],
      ["textActions", "tools"],
      ["cli", "tools"],
    ],
  );
  assert.equal(
    settings.length,
    navigation.PREFERENCE_SETTING_IDS.length,
  );
  assert.deepEqual(
    navigation.filterPreferenceSettings(settings, "  JSON  ").map(({ id }) => id),
    ["text-actions.json"],
  );
  assert.equal(navigation.filterPreferenceSettings(settings, "").length, 0);
  assert.ok(settings.every((entry) => !("value" in entry)));
  assert.ok(settings.every((entry) => !entry.aliases.includes("clipboard content")));
});

test("preference saves are sequential and stale results never replace the latest edit", async () => {
  const { createPreferenceSaveController } = await importTypeScriptModule(
    "src/components/preferences/preferenceSaveController.ts",
  );
  const savedSnapshots = [];
  const visibleSnapshots = [];
  const feedbackSnapshots = [];
  let releaseFirst;
  const firstSave = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let saveCount = 0;
  const controller = createPreferenceSaveController({
    initialSettings: { count: 0 },
    normalize: (settings) => ({ count: Math.max(0, settings.count) }),
    onFeedback: (feedback) => feedbackSnapshots.push(feedback),
    onSettings: (settings) => visibleSnapshots.push(settings),
    save: async (settings) => {
      savedSnapshots.push(settings);
      saveCount += 1;
      if (saveCount === 1) {
        await firstSave;
      }
      return settings;
    },
  });

  const first = controller.apply("count", () => ({ count: 1 }));
  const second = controller.apply("count", () => ({ count: 2 }));
  assert.equal(controller.hasPending(), true);
  assert.deepEqual(controller.getLatest(), { count: 2 });
  releaseFirst();
  await Promise.all([first, second]);

  assert.deepEqual(savedSnapshots, [{ count: 1 }, { count: 2 }]);
  assert.deepEqual(controller.getLatest(), { count: 2 });
  assert.deepEqual(visibleSnapshots.at(-1), { count: 2 });
  assert.equal(feedbackSnapshots.at(-1).count, "saved");
  assert.equal(controller.hasPending(), false);
});

test("latest preference save failure rolls back and reports only its row", async () => {
  const { createPreferenceSaveController } = await importTypeScriptModule(
    "src/components/preferences/preferenceSaveController.ts",
  );
  const visibleSnapshots = [];
  let feedback = {};
  const controller = createPreferenceSaveController({
    initialSettings: { enabled: false, other: true },
    normalize: (settings) => settings,
    onFeedback: (nextFeedback) => {
      feedback = nextFeedback;
    },
    onSettings: (settings) => visibleSnapshots.push(settings),
    save: async () => {
      throw new Error("save failed");
    },
  });

  await controller.apply("enabled", (settings) => ({ ...settings, enabled: true }));

  assert.deepEqual(controller.getLatest(), { enabled: false, other: true });
  assert.deepEqual(visibleSnapshots.at(-1), { enabled: false, other: true });
  assert.deepEqual(feedback, { enabled: "error" });
});
