import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readStylesCss() {
  return readFile("src/styles.css", "utf8");
}

function themeVariables(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  assert.ok(match, `${selector} theme block should exist`);

  return Object.fromEntries(
    Array.from(match[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)).map(
      ([, name, value]) => [name, value.trim()],
    ),
  );
}

function parseColor(value, variables) {
  const resolved = value.startsWith("var(")
    ? variables[value.slice(4, -1).trim()]
    : value;

  assert.ok(resolved, `color ${value} should resolve`);

  const hex = resolved.match(/^#([0-9a-f]{6})$/i);

  if (hex) {
    const raw = hex[1];

    return {
      alpha: 1,
      blue: Number.parseInt(raw.slice(4, 6), 16),
      green: Number.parseInt(raw.slice(2, 4), 16),
      red: Number.parseInt(raw.slice(0, 2), 16),
    };
  }

  const rgba = resolved.match(
    /^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/i,
  );

  assert.ok(rgba, `color ${resolved} should be hex, rgb, or rgba`);

  return {
    alpha: rgba[4] === undefined ? 1 : Number.parseFloat(rgba[4]),
    blue: Number.parseFloat(rgba[3]),
    green: Number.parseFloat(rgba[2]),
    red: Number.parseFloat(rgba[1]),
  };
}

function compositeOverWhite(color) {
  const alpha = color.alpha;

  return {
    blue: color.blue * alpha + 255 * (1 - alpha),
    green: color.green * alpha + 255 * (1 - alpha),
    red: color.red * alpha + 255 * (1 - alpha),
  };
}

function channelToLinear(value) {
  const normalized = value / 255;

  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  return (
    0.2126 * channelToLinear(color.red) +
    0.7152 * channelToLinear(color.green) +
    0.0722 * channelToLinear(color.blue)
  );
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );

  return (lighter + 0.05) / (darker + 0.05);
}

test("light theme readable tokens meet contrast targets", async () => {
  const css = await readStylesCss();
  const variables = {
    ...themeVariables(css, ":root"),
    ...themeVariables(css, ':root[data-app-theme="light"]'),
  };
  const requiredPairs = [
    ["--mclip-ink", "--mclip-surface", 4.5],
    ["--mclip-ink-soft", "--mclip-surface", 4.5],
    ["--mclip-ink-dim", "--mclip-surface", 4.5],
    ["--mclip-placeholder", "--mclip-surface", 4.5],
    ["--mclip-index", "--mclip-surface", 4.5],
    ["--mclip-meta", "--mclip-surface-translucent", 4.5],
    ["--mclip-kicker", "--mclip-surface-translucent", 4.5],
    ["--mclip-accent", "--mclip-surface", 4.5],
    ["--mclip-accent-cool", "--mclip-surface", 4.5],
    ["--mclip-danger", "--mclip-surface", 4.5],
    ["--mclip-focus", "--mclip-surface", 3],
    ["--mclip-line-strong", "--mclip-surface", 3],
  ];

  for (const [foregroundToken, backgroundToken, minimum] of requiredPairs) {
    const foreground = compositeOverWhite(
      parseColor(variables[foregroundToken], variables),
    );
    const background = compositeOverWhite(
      parseColor(variables[backgroundToken], variables),
    );
    const contrast = contrastRatio(foreground, background);

    assert.ok(
      contrast >= minimum,
      `${foregroundToken} on ${backgroundToken} should be >= ${minimum}:1, got ${contrast.toFixed(2)}:1`,
    );
  }
});

test("light theme readability classes use semantic color tokens", async () => {
  const stylesSource = await readFile("src/uiStyles.ts", "utf8");

  for (const token of [
    "--mclip-index",
    "--mclip-meta",
    "--mclip-kicker",
    "--mclip-placeholder",
    "--mclip-accent-cool",
    "--mclip-danger",
  ]) {
    assert.match(stylesSource, new RegExp(`var\\(${token}\\)`));
  }
});
