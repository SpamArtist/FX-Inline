import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const dropdownSourcePath = path.join(
  extensionRoot,
  "components/Dropdown/Dropdown.tsx",
);
const currencyBoxSourcePath = path.join(
  extensionRoot,
  "components/CurrencyBox/CurrencyBox.tsx",
);

function collectExtensionSourceFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "test-dist" || entry.name === "tests") continue;
      files.push(...collectExtensionSourceFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

test("popup currency picker uses native select markup", () => {
  const dropdownSource = fs.readFileSync(dropdownSourcePath, "utf8");

  expect(dropdownSource).toContain("<select");
  expect(dropdownSource).not.toContain("DropdownMenu");
});

test("extension source does not import Radix DropdownMenu", () => {
  const radixImports = collectExtensionSourceFiles(extensionRoot).flatMap((sourcePath) => {
    const source = fs.readFileSync(sourcePath, "utf8");
    return source.includes("@radix-ui/") ? [sourcePath] : [];
  });

  expect(radixImports).toEqual([]);
});

test("popup amount input records edits before Enter commits them", () => {
  const currencyBoxSource = fs.readFileSync(currencyBoxSourcePath, "utf8");

  expect(currencyBoxSource).toContain("onInput={handleAmountChange}");
  expect(currencyBoxSource).not.toContain("onChange={handleAmountChange}");
});
