import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const sharedThemePages = [
  "entrypoints/options/index.html",
  "entrypoints/popup/index.html",
  "entrypoints/welcome/index.html",
];

const sharedThemeEntrypoints = [
  "entrypoints/options/main.ts",
  "entrypoints/popup/main.tsx",
  "entrypoints/welcome/main.ts",
];

test("extension pages do not use static shared theme links", () => {
  for (const relativePath of sharedThemePages) {
    const html = fs.readFileSync(path.join(extensionRoot, relativePath), "utf8");

    expect(html).not.toContain("theme.css");
  }
});

test("extension page entrypoints attach the shared theme at runtime", () => {
  for (const relativePath of sharedThemeEntrypoints) {
    const source = fs.readFileSync(path.join(extensionRoot, relativePath), "utf8");

    expect(source).toContain("attachSharedThemeStylesheet");
    expect(source).toContain("attachSharedThemeStylesheet();");
  }

  const helperSource = fs.readFileSync(
    path.join(extensionRoot, "utils/sharedThemeStylesheet.ts"),
    "utf8",
  );

  expect(helperSource).toContain('browser.runtime.getURL(SHARED_THEME_STYLESHEET_PATH)');
  expect(helperSource).toContain('const SHARED_THEME_STYLESHEET_PATH = "/theme.css";');
});

test("popup layout keeps the extension box compact and flex-based", () => {
  const appCss = fs.readFileSync(
    path.join(extensionRoot, "entrypoints/popup/App.css"),
    "utf8",
  );
  const styleCss = fs.readFileSync(
    path.join(extensionRoot, "entrypoints/popup/style.css"),
    "utf8",
  );

  expect(appCss).toContain("width: 520px;");
  expect(appCss).toContain("max-width: 100vw;");
  expect(appCss).toContain("display: flex;");
  expect(appCss).toContain("flex-direction: column;");
  expect(appCss).toContain("flex: 1 1 0;");
  expect(appCss).toContain("flex: 0 0 1px;");
  expect(appCss).not.toContain("display: grid;");
  expect(styleCss).toContain("display: flex;");
  expect(styleCss).not.toContain("0.7vw");
});
