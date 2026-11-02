import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { messageKey, placeholderNames } from "../../apps/extension/utils/messageKey.ts";

export const LOCALES = [
  "en", "de", "fr", "es", "it", "pt_PT", "pt_BR", "nl", "pl", "sv", "da",
  "no", "fi", "cs", "ro", "hu", "el", "tr", "uk",
];
const root = fileURLToPath(new URL("../../", import.meta.url));
const extension = path.join(root, "apps/extension");
const manifestMessages = {
  extensionName: "FX Inline",
  extensionDescription: "FX Inline converts prices directly on webpages into your preferred currency, so you can compare costs without leaving the page.",
};

export function collectStrings(source, filename = "source.tsx") {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const strings = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
      const first = node.arguments[0];
      if (!first || !(ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
        throw new Error(`${filename}: t() needs literal English text; use named placeholders for values.`);
      }
      strings.push(first.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return strings;
}

async function collectDirectory(directory) {
  const strings = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (["generated", "tests", "test-dist", "content-test-dist", "public", "node_modules"].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) strings.push(...await collectDirectory(filename));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      strings.push(...collectStrings(await fs.readFile(filename, "utf8"), filename));
    }
  }
  return strings;
}

export function createCatalog(strings, translations, locale) {
  const catalog = {};
  const seen = new Map();
  for (const english of [...new Set(strings)].sort()) {
    const translated = locale === "en" ? english : translations[english];
    if (typeof translated !== "string" || !translated.trim()) {
      throw new Error(`${locale}: missing translation for ${english}`);
    }
    if (translated.includes('"')) throw new Error(`${locale}: use typographic quotes in ${english}`);
    const names = placeholderNames(english);
    const tokens = (value) => [...value.matchAll(/\{[^{}]*\}/g)].map((match) => match[0]).sort();
    if (JSON.stringify(tokens(english)) !== JSON.stringify(tokens(translated))) {
      throw new Error(`${locale}: broken placeholder in ${english}`);
    }
    if (names.length > 9) throw new Error(`${locale}: Chrome supports at most 9 placeholders`);
    const key = messageKey(english);
    if (seen.has(key) && seen.get(key) !== english) throw new Error(`Message hash collision: ${english}`);
    seen.set(key, english);
    const placeholders = Object.fromEntries(names.map((name, index) => [name, { content: `$${index + 1}` }]));
    catalog[key] = {
      message: translated.replaceAll("$", "$$$$").replace(/\{([a-z][a-z0-9_]*)\}/gi, (_, name) => `$${name}$`),
      description: english,
      ...(names.length ? { placeholders } : {}),
    };
  }
  for (const [key, english] of Object.entries(manifestMessages)) {
    if (!catalog[messageKey(english)]) continue;
    const entry = catalog[messageKey(english)];
    const limit = key === "extensionName" ? 75 : 132;
    if ([...entry.message].length >= limit) throw new Error(`${locale}.${key}: must be under ${limit} characters`);
    catalog[key] = entry;
  }
  return catalog;
}

export async function buildLocales({ check = false } = {}) {
  const strings = [...await collectDirectory(extension), ...Object.values(manifestMessages)];
  const outputs = [];
  for (const locale of LOCALES) {
    const translations = locale === "en" ? {} : JSON.parse(await fs.readFile(
      path.join(root, `scripts/i18n/translations/${locale}.json`), "utf8"));
    const catalog = createCatalog(strings, translations, locale);
    outputs.push([path.join(extension, `public/_locales/${locale}/messages.json`), JSON.stringify(catalog, null, 2) + "\n"]);
    const listing = await fs.readFile(path.join(root, `store-listing/${locale}/chrome.txt`), "utf8");
    if (!listing.trim() || listing.includes('"')) throw new Error(`${locale}: missing listing or straight double quotes`);
  }
  // Validate every locale before updating any catalog.
  for (const [filename, content] of outputs) {
    if (check) {
      if (await fs.readFile(filename, "utf8").catch(() => "") !== content) throw new Error(`${filename}: stale catalog; run npm run build:locales`);
    } else {
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, content);
    }
  }
  console.log(`${check ? "Checked" : "Built"} ${LOCALES.length} locales; ${new Set(strings).size} English strings; store listings complete.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await buildLocales({ check: process.argv.includes("--check") });
}
