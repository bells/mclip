import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

async function importTypeScriptModule(sourcePath) {
  const absoluteSourcePath = path.resolve(sourcePath);
  const source = await readFile(absoluteSourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absoluteSourcePath,
  });
  const compiledPath = path.join(
    tmpdir(),
    `mclip-sensitive-${Date.now()}-${Math.random()}.mjs`,
  );
  await writeFile(compiledPath, output.outputText, "utf8");
  return import(compiledPath);
}

const {
  isSensitiveTextMasked,
  maskSensitiveHistoryEntry,
  normalizeSensitiveHistoryRevealError,
  SENSITIVE_CONTENT_MASK,
} = await importTypeScriptModule("src/utils/sensitiveContent.ts");

function secretEntry() {
  return {
    copyCount: 1,
    displayText: "sk-proj-SYNTHETIC_FIXTURE_NOT_A_REAL_KEY_1234567890",
    firstCopiedAt: 1,
    id: "sensitive-fixture",
    isPinned: false,
    kind: "text",
    lastCopiedAt: 2,
    pinnedAt: null,
    secretDetectorVersion: 1,
    secretType: "openAiApiKey",
    sourceApp: null,
    text: "sk-proj-SYNTHETIC_FIXTURE_NOT_A_REAL_KEY_1234567890",
  };
}

test("classified text view models are masked without mutating canonical input", () => {
  const original = secretEntry();
  const masked = maskSensitiveHistoryEntry(original, true);

  assert.equal(masked.text, SENSITIVE_CONTENT_MASK);
  assert.equal(masked.displayText, SENSITIVE_CONTENT_MASK);
  assert.equal(masked.secretType, "openAiApiKey");
  assert.equal(isSensitiveTextMasked(masked), true);
  assert.notEqual(masked, original);
  assert.notEqual(original.text, SENSITIVE_CONTENT_MASK);
});

test("disabling masking preserves the original entry reference", () => {
  const original = secretEntry();
  assert.equal(maskSensitiveHistoryEntry(original, false), original);
});

test("reveal is explicit and clears on item and window lifecycle events", async () => {
  const [panelSource, windowSource] = await Promise.all([
    readFile("src/components/HistoryDetailPanel.tsx", "utf8"),
    readFile("src-tauri/src/window.rs", "utf8"),
  ]);

  assert.match(panelSource, /onClick=\{\(\) => void toggleSensitiveReveal\(\)\}/);
  assert.doesNotMatch(panelSource, /on(?:MouseEnter|PointerEnter|Focus).*toggleSensitiveReveal/);
  assert.match(panelSource, /useEffect\(\(\) => \{[\s\S]*setRevealedText\(null\)[\s\S]*\}, \[item\]\)/);
  assert.match(panelSource, /listenToSensitiveRevealReset/);
  assert.match(windowSource, /SENSITIVE_REVEAL_RESET_EVENT/);
  assert.match(windowSource, /preview_window\.emit\(SENSITIVE_REVEAL_RESET_EVENT/);
  assert.match(windowSource, /preview_detail_window\.emit\(SENSITIVE_REVEAL_RESET_EVENT/);
});

test("reveal errors preserve stable Rust codes and use a safe fallback", () => {
  assert.equal(
    normalizeSensitiveHistoryRevealError({ code: "itemNotFound" }).code,
    "itemNotFound",
  );
  assert.equal(
    normalizeSensitiveHistoryRevealError(
      '{"code":"classificationStale"}',
    ).code,
    "classificationStale",
  );
  assert.equal(
    normalizeSensitiveHistoryRevealError(new Error("historyUnavailable")).code,
    "historyUnavailable",
  );
  assert.equal(
    normalizeSensitiveHistoryRevealError("unexpected backend failure").code,
    "historyUnavailable",
  );
});

test("stale reveal refreshes main history, closes old details, and reports specific feedback", async () => {
  const [panelSource, dataSource, previewSource, detailSource, appSource, i18nSource] =
    await Promise.all([
      readFile("src/components/HistoryDetailPanel.tsx", "utf8"),
      readFile("src/hooks/useClipboardDataController.ts", "utf8"),
      readFile("src/components/HistoryPreviewWindow.tsx", "utf8"),
      readFile("src/components/HistoryPreviewDetailWindow.tsx", "utf8"),
      readFile("src/App.tsx", "utf8"),
      readFile("src/i18n.ts", "utf8"),
    ]);

  assert.doesNotMatch(panelSource, /catch\s*\{\s*setRevealError/);
  assert.match(panelSource, /normalizeSensitiveHistoryRevealError/);
  assert.match(panelSource, /onSensitiveItemStale\?\.\(\)/);
  assert.match(dataSource, /listenToSensitiveHistoryRevealFailed/);
  assert.match(dataSource, /void refreshHistorySnapshot\(\)/);
  assert.match(previewSource, /onSensitiveItemStale=\{\(\) => \{[\s\S]*hideHistoryPreviewWindow/);
  assert.match(detailSource, /onSensitiveItemStale=\{\(\) => \{[\s\S]*hideHistoryPreviewDetailWindow/);
  assert.match(appSource, /historyStatusNotice/);
  assert.match(i18nSource, /该记录已变化/);
  assert.match(i18nSource, /This record has changed/);
});

test("privacy preferences remain immediate-save and disclose plaintext storage", async () => {
  const [preferencesSource, i18nSource, settingsSource] = await Promise.all([
    readFile("src/components/PreferencesWindow.tsx", "utf8"),
    readFile("src/i18n.ts", "utf8"),
    readFile("src/utils/settings.ts", "utf8"),
  ]);

  assert.match(preferencesSource, /\["privacy", t\.privacyTab\]/);
  assert.match(preferencesSource, /applySettingsPatch/);
  assert.match(preferencesSource, /maskSensitiveContent/);
  assert.match(preferencesSource, /ignoredSourceAppIds/);
  assert.match(preferencesSource, /getSourceAppDetectionStatus/);
  assert.match(preferencesSource, /reclassifySensitiveHistory/);
  assert.doesNotMatch(preferencesSource, /t\.(?:save|cancel)\b/);
  assert.match(i18nSource, /仍在本机以明文保存历史/);
  assert.match(i18nSource, /still stores history as local plaintext/);
  assert.match(settingsSource, /MAX_IGNORED_SOURCE_APP_COUNT/);
});

test("repository and release documentation state heuristic and plaintext limits", async () => {
  const [readme, agents, releaseWorkflow] = await Promise.all([
    readFile("README.md", "utf8"),
    readFile("AGENTS.md", "utf8"),
    readFile(".github/workflows/release.yml", "utf8"),
  ]);

  assert.match(readme, /遮罩只保护界面与默认 CLI 输出，不是静态加密/);
  assert.match(readme, /Masking protects the UI and default CLI output; it is not encryption at rest/);
  assert.match(readme, /--reveal-secrets/);
  assert.match(agents, /detector v1 最多扫描 64 KiB/);
  assert.match(agents, /纯 Wayland 必须报告 unavailable/);
  assert.match(releaseWorkflow, /敏感内容检测和来源应用识别都是启发式/);
  assert.match(releaseWorkflow, /Masking is presentation protection, not encryption at rest/);
});
