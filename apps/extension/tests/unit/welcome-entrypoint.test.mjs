import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const welcomeDir = resolve(testDir, "../../entrypoints/welcome");
const scriptTagPattern = /<script\b[^>]*><\/script>/gi;
const moduleTypePattern = /\btype=["']module["']/i;
const scriptSrcPattern = /\bsrc=["']([^"']+)["']/i;

function getModuleScriptSources(indexHtml) {
  return [...indexHtml.matchAll(scriptTagPattern)]
    .map((match) => match[0])
    .filter((scriptTag) => moduleTypePattern.test(scriptTag))
    .map((scriptTag) => scriptSrcPattern.exec(scriptTag)?.[1])
    .filter((scriptSrc) => typeof scriptSrc === "string");
}

test("welcome page wires a single vanilla TypeScript module", () => {
  const indexHtml = readFileSync(resolve(welcomeDir, "index.html"), "utf8");
  const moduleScripts = getModuleScriptSources(indexHtml);

  expect(moduleScripts).toEqual(["./main.ts"]);
  expect(existsSync(resolve(welcomeDir, "main.ts"))).toBe(true);
});

test("welcome page does not keep dead React implementation files", () => {
  expect(existsSync(resolve(welcomeDir, "main.tsx"))).toBe(false);
  expect(existsSync(resolve(welcomeDir, "App.tsx"))).toBe(false);
});
