import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(path, "utf8");
}

function cssRule(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  assert.ok(match, `${selector} rule should exist`);
  return match[1];
}

function cssRules(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = Array.from(
    css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, "g")),
  );

  assert.ok(matches.length > 0, `${selector} rule should exist`);
  return matches.map((match) => match[1]);
}

test("main history and archive navigation share a bounded scroll region", async () => {
  const appSource = await readSource("src/App.tsx");
  const css = await readSource("src/App.css");
  const headerRule = cssRule(css, ".app-header");
  const scrollRule = cssRule(css, ".app-main-scroll-region");
  const footerRules = cssRules(css, ".app-footer");
  const bodyRule = cssRule(css, ".app-body");

  assert.match(appSource, /className="app-main-scroll-region"/);
  assert.match(scrollRule, /flex:\s*1\s+1\s+auto;/);
  assert.match(scrollRule, /min-height:\s*0;/);
  assert.match(scrollRule, /overflow-y:\s*auto;/);
  assert.match(scrollRule, /overscroll-behavior:\s*contain;/);
  assert.match(headerRule, /flex-shrink:\s*0;/);
  assert.ok(
    footerRules.some((rule) => /flex-shrink:\s*0;/.test(rule)),
    "base footer rule should stay fixed outside the scroll region",
  );
  assert.match(bodyRule, /flex:\s*0\s+0\s+auto;/);
  assert.doesNotMatch(bodyRule, /overflow:\s*visible;/);
});
