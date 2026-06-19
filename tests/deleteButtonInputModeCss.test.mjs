import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readAppCss() {
  return readFile("src/App.css", "utf8");
}

function cssRule(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  return match?.[1] ?? "";
}

test("keyboard navigation suppresses stale hover affordances", async () => {
  const css = await readAppCss();
  const mainHoverRule = cssRule(
    css,
    ".app-frame.is-keyboard-navigating .app-item-row:hover:not(.is-selected)",
  );
  const mainRule = cssRule(
    css,
    ".app-frame.is-keyboard-navigating .app-item-row:hover:not(.is-selected) .app-item-delete",
  );
  const previewRule = cssRule(
    css,
    ".app-frame.is-keyboard-navigating .app-history-preview-item-row:hover:not(.is-selected) .app-history-preview-delete",
  );
  const groupPreviewRule = cssRule(
    css,
    ".app-history-group-preview-window.is-keyboard-navigating .app-history-preview-item-row:hover:not(.is-selected)",
  );
  const groupPreviewDeleteRule = cssRule(
    css,
    ".app-history-group-preview-window.is-keyboard-navigating .app-history-preview-item-row:hover:not(.is-selected) .app-history-preview-delete",
  );

  assert.match(mainHoverRule, /background:\s*transparent;/);
  assert.match(mainHoverRule, /box-shadow:\s*none;/);
  assert.match(mainRule, /opacity:\s*0;/);
  assert.match(mainRule, /pointer-events:\s*none;/);
  assert.match(previewRule, /opacity:\s*0;/);
  assert.match(previewRule, /pointer-events:\s*none;/);
  assert.match(groupPreviewRule, /background:\s*transparent;/);
  assert.match(groupPreviewRule, /box-shadow:\s*none;/);
  assert.match(groupPreviewDeleteRule, /opacity:\s*0;/);
  assert.match(groupPreviewDeleteRule, /pointer-events:\s*none;/);
});
