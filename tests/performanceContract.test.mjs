import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { summarizeInteractionDurations } from "../scripts/performance/summarize-trace.mjs";

test("performance payload has an allowlisted privacy-safe shape", async () => {
  const [rustSource, typeSource] = await Promise.all([
    readFile("src-tauri/src/performance.rs", "utf8"),
    readFile("src/types.ts", "utf8"),
  ]);

  assert.match(rustSource, /deny_unknown_fields/);
  assert.match(rustSource, /MAX_INTERACTION_ID_CHARS/);
  assert.match(rustSource, /MCLIP_PERF_MODE/);
  assert.match(typeSource, /export type PerformanceMilestone = \{/);

  for (const forbidden of ["clipboardText", "filePath", "sourceApp", "searchQuery", "imageBytes"]) {
    const performanceType = typeSource.slice(
      typeSource.indexOf("export type PerformanceMilestone = {"),
      typeSource.indexOf("};", typeSource.indexOf("export type PerformanceMilestone = {")),
    );
    assert.doesNotMatch(performanceType, new RegExp(forbidden));
  }
});

test("interaction summaries pair only Rust-clock records with the same id", () => {
  const records = [
    { clock: "rust", elapsedMs: 100, interactionId: "preview-1", milestone: "previewRequest", windowLabel: "preview" },
    { clock: "frontend", elapsedMs: 12, interactionId: "preview-1", milestone: "previewPainted", windowLabel: "preview" },
    { clock: "rust", elapsedMs: 118, interactionId: "preview-1", milestone: "previewPainted", windowLabel: "preview" },
    { clock: "rust", elapsedMs: 125, interactionId: "preview-1", milestone: "imageReady", windowLabel: "preview" },
    { clock: "rust", elapsedMs: 140, interactionId: "preview-2", milestone: "previewRequest", windowLabel: "preview" },
    { clock: "rust", elapsedMs: 151, interactionId: "preview-2", milestone: "previewPainted", windowLabel: "preview" },
  ];
  const summary = summarizeInteractionDurations(records.map(JSON.stringify));

  assert.deepEqual(summary["preview:previewRequest->previewPainted"], {
    count: 2,
    medianMs: 11,
    p95Ms: 18,
  });
  assert.deepEqual(summary["preview:previewRequest->imageReady"], {
    count: 1,
    medianMs: 25,
    p95Ms: 25,
  });
});
