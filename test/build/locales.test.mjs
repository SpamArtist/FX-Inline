import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { buildLocales, collectStrings, createCatalog } from "../../scripts/i18n/build-locales.mjs";
import { messageKey } from "../../apps/extension/utils/messageKey.ts";

test("extracts literals from TSX, ignoring comments and unrelated strings", () => {
  assert.deepEqual(collectStrings(`// t('Ignored')\nconst x = <p title={t('Title')}>{t(\`Hello {name}\`, {name})}</p>; console.log('Log');`), ["Title", "Hello {name}"]);
  assert.throws(() => collectStrings('t(`Hello ${name}`)'), /literal English/);
  assert.throws(() => collectStrings('t(condition ? "Yes" : "No")'), /literal English/);
});

test("missing translations and changed, dropped or repeated placeholders block builds", () => {
  const source = "{from} to {to}";
  assert.throws(() => createCatalog([source], {}, "de"), /missing translation/);
  for (const value of ["{from} nach", "{from} nach {other}", "{from} nach {to} {to}", "{from} nach {TO}"]) {
    assert.throws(() => createCatalog([source], { [source]: value }, "de"), /broken placeholder/);
  }
});

test("translations can reorder placeholders without changing substitution positions", () => {
  const source = "{from} to {to}";
  const entry = createCatalog([source], { [source]: "{to} ← {from}" }, "de")[messageKey(source)];
  assert.deepEqual(entry.placeholders, { from: { content: "$1" }, to: { content: "$2" } });
  assert.equal(entry.message, "$to$ ← $from$");
});

test("literal dollars are escaped for Chrome and straight quotes are rejected", () => {
  assert.equal(createCatalog(["Price $5"], {}, "en")[messageKey("Price $5")].message, "Price $$5");
  assert.throws(() => createCatalog(["Hello"], { Hello: 'Say "Hi"' }, "de"), /typographic quotes/);
});

test("manifest text must remain below each character limit", () => {
  assert.throws(() => createCatalog(["FX Inline"], { "FX Inline": "x".repeat(75) }, "de"), /under 75/);
  const description = "FX Inline converts prices directly on webpages into your preferred currency, so you can compare costs without leaving the page.";
  assert.throws(() => createCatalog([description], { [description]: "x".repeat(132) }, "de"), /under 132/);
});

test("all shipped catalogs match extracted source and complete translations", async () => {
  await buildLocales({ check: true });
});

// Chrome on macOS requests nb even though the store locale is no.
test("Norwegian Bokmål browser alias ships the complete Norwegian catalog", async () => {
  const readCatalog = async (locale) => JSON.parse(await fs.readFile(new URL(
    `../../apps/extension/public/_locales/${locale}/messages.json`, import.meta.url,
  ), "utf8"));
  const [norwegian, bokmal] = await Promise.all([readCatalog("no"), readCatalog("nb")]);
  assert.deepEqual(bokmal, norwegian);
  assert.notEqual(bokmal[messageKey("Feedback ↗")].message, "Feedback ↗");
});
