import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

// This mode has no current UI caller. It stays in the worksheet for future use.
const OPTIONAL_MESSAGE_KEYS = new Set(["amountUpdatesInstantly"]);

function placeholderNames(message) {
  return Array.from(message.matchAll(/\$([a-z][a-z0-9_]*)\$/gi),
    (match) => match[1].toLowerCase()).sort();
}

export function validateCatalogs(english, swedish, { requireComplete = false } = {}) {
  const errors = [];

  for (const [locale, catalog] of [["en", english], ["sv", swedish]]) {
    for (const [key, entry] of Object.entries(catalog)) {
      if (typeof entry?.message !== "string" || !entry.message.trim()) {
        errors.push(`${locale}.${key}: message must contain text; omit unfinished Swedish entries.`);
        continue;
      }
      if (!Object.hasOwn(english, key)) {
        errors.push(`${locale}.${key}: unknown message key.`);
        continue;
      }

      const names = placeholderNames(entry.message);
      const declared = Object.keys(entry.placeholders ?? {}).map((name) => name.toLowerCase()).sort();
      if (JSON.stringify([...new Set(names)]) !== JSON.stringify(declared)) {
        errors.push(`${locale}.${key}: message and placeholder definitions differ.`);
      }
      for (const [name, placeholder] of Object.entries(entry.placeholders ?? {})) {
        if (!/^\$[1-9]$/.test(placeholder?.content ?? "")) {
          errors.push(`${locale}.${key}.${name}: expected a substitution such as $1.`);
        }
      }
      if (/\$\d/.test(entry.message)) {
        errors.push(`${locale}.${key}: use named placeholders in message text.`);
      }

      if (locale === "sv" && typeof english[key]?.message === "string") {
        if (JSON.stringify(names) !== JSON.stringify(placeholderNames(english[key].message))) {
          errors.push(`sv.${key}: preserve the English placeholders.`);
        }
        const sourcePlaceholders = english[key].placeholders ?? {};
        for (const [name, placeholder] of Object.entries(entry.placeholders ?? {})) {
          if (sourcePlaceholders[name]?.content !== placeholder?.content) {
            errors.push(`sv.${key}.${name}: preserve the English substitution mapping.`);
          }
        }
      }
    }
  }

  if (swedish.extensionName?.message !== english.extensionName?.message) {
    errors.push("sv.extensionName: keep the product name unchanged.");
  }
  if (requireComplete) {
    for (const key of Object.keys(english)) {
      const translated = swedish[key]?.message;
      if (!OPTIONAL_MESSAGE_KEYS.has(key) &&
          (typeof translated !== "string" || !translated.trim())) {
        errors.push(`sv.${key}: translation required before the Swedish release.`);
      }
    }
  }
  return errors;
}

async function main() {
  const [english, swedish] = await Promise.all(["en", "sv"].map(async (locale) =>
    JSON.parse(await fs.readFile(new URL(
      `../../apps/extension/public/_locales/${locale}/messages.json`, import.meta.url,
    ), "utf8")),
  ));
  const requireComplete = process.argv.includes("--require-complete");
  const errors = validateCatalogs(english, swedish, { requireComplete });
  if (errors.length) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  const required = Object.keys(english).filter((key) =>
    key !== "extensionName" && !OPTIONAL_MESSAGE_KEYS.has(key),
  );
  const completed = required.filter((key) => swedish[key]?.message?.trim()).length;
  console.log(`Locale checks passed. Swedish translations: ${completed}/${required.length} active entries.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
