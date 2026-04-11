import { readFile, writeFile } from "node:fs/promises";

const targetFiles = [
  "apps/extension/test-dist/entrypoints/content/inlineConversion.js",
  "apps/extension/test-dist/entrypoints/content/conversionRuntime.js",
  "apps/extension/test-dist/entrypoints/content/perfLogger.js",
  "apps/extension/test-dist/entrypoints/content/perfLogger/logger.js",
];

for (const targetFile of targetFiles) {
  let source = "";

  try {
    source = await readFile(targetFile, "utf8");
  } catch {
    continue;
  }

  const next = source.replaceAll("import.meta.env.DEV", "false");

  if (next !== source) {
    await writeFile(targetFile, next, "utf8");
  }
}
