import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function getEffectBlockContaining(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `${marker} should exist`);

  const effectStart = source.lastIndexOf("useEffect(() => {", markerIndex);
  assert.notEqual(effectStart, -1, `${marker} should be inside a useEffect`);

  const effectEnd = source.indexOf("  }, []);", markerIndex);
  assert.notEqual(effectEnd, -1, `${marker} useEffect should have an empty dependency array`);

  return source.slice(effectStart, effectEnd);
}

test("preview keyboard navigation listener cleans up async subscriptions", async () => {
  const source = await readFile("src/components/HistoryPreviewWindow.tsx", "utf8");
  const listenerBlock = getEffectBlockContaining(
    source,
    "void listenToHistoryPreviewKeyboardNavigation",
  );

  assert.match(listenerBlock, /let isActive = true;/);
  assert.match(listenerBlock, /\.then\(\(unsubscribe\) => \{/);
  assert.match(listenerBlock, /if \(isActive\) \{/);
  assert.match(listenerBlock, /unlisten = unsubscribe;/);
  assert.match(listenerBlock, /unsubscribe\(\);/);
  assert.match(listenerBlock, /isActive = false;/);
  assert.match(listenerBlock, /unlisten\?\.\(\);/);
});
