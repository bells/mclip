import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) {
    return null;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil((percentileValue / 100) * sortedValues.length) - 1,
  );
  return sortedValues[index];
}

function summarizeValues(values) {
  const sortedValues = values.toSorted((left, right) => left - right);
  return {
    count: sortedValues.length,
    medianMs: percentile(sortedValues, 50),
    p95Ms: percentile(sortedValues, 95),
  };
}

function parseTraceLines(lines) {
  return lines.filter(Boolean).map((line) => JSON.parse(line));
}

export function summarizeTraceLines(lines) {
  const milestones = parseTraceLines(lines);
  const groups = new Map();
  for (const milestone of milestones) {
    const key = `${milestone.clock}:${milestone.milestone}:${milestone.windowLabel ?? "none"}`;
    const values = groups.get(key) ?? [];
    values.push(milestone.elapsedMs);
    groups.set(key, values);
  }

  return Object.fromEntries(
    [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(
      ([key, values]) => {
        return [key, summarizeValues(values)];
      },
    ),
  );
}

export function summarizeInteractionDurations(lines) {
  const milestones = parseTraceLines(lines);
  const pairs = [
    ["mainShowRequest", "mainPainted", "main"],
    ["previewRequest", "previewPainted", "preview"],
    ["previewRequest", "previewPainted", "preview-detail"],
    ["viewerRequest", "viewerPainted", "image-viewer"],
    ["previewRequest", "imageReady", "preview"],
    ["previewRequest", "imageReady", "preview-detail"],
    ["viewerRequest", "imageReady", "image-viewer"],
  ];
  const groups = new Map();

  for (const [requestName, completionName, windowLabel] of pairs) {
    const requests = milestones.filter((entry) =>
      entry.clock === "rust" &&
      entry.milestone === requestName &&
      entry.windowLabel === windowLabel &&
      entry.interactionId,
    );
    for (const request of requests) {
      const completion = milestones.find((entry) =>
        entry.clock === "rust" &&
        entry.milestone === completionName &&
        entry.windowLabel === windowLabel &&
        entry.interactionId === request.interactionId &&
        entry.elapsedMs >= request.elapsedMs,
      );
      if (!completion) continue;
      const key = `${windowLabel}:${requestName}->${completionName}`;
      const values = groups.get(key) ?? [];
      values.push(completion.elapsedMs - request.elapsedMs);
      groups.set(key, values);
    }
  }

  return Object.fromEntries(
    [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(
      ([key, values]) => [key, summarizeValues(values)],
    ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const tracePath = process.argv[2];
  if (!tracePath) {
    throw new Error("usage: node scripts/performance/summarize-trace.mjs <trace.jsonl>");
  }
  const trace = await readFile(tracePath, "utf8");
  const lines = trace.split(/\r?\n/);
  process.stdout.write(`${JSON.stringify({
    interactionDurations: summarizeInteractionDurations(lines),
    milestones: summarizeTraceLines(lines),
  }, null, 2)}\n`);
}
