#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDirectory, "..");
const outputPath = path.join(
  repoRoot,
  "architecture/likec4/generated/model.c4",
);

function readFileSafe(relativePath) {
  try {
    return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function extractStringArrayByKey(source, key) {
  const keyPattern = `${key}:\\s*\\[([\\s\\S]*?)\\]`;
  const match = source.match(new RegExp(keyPattern, "m"));
  if (!match?.[1]) {
    return [];
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1]);
}

function extractMatch(source, expression) {
  return source.match(expression)?.[1] ?? null;
}

function extractRateProviderUrls(source) {
  return Array.from(source.matchAll(/url:\s*"([^"]+)"/g), (entry) => entry[1]);
}

function q(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function writeLine(lines, indentationLevel, text = "") {
  lines.push(`${"  ".repeat(indentationLevel)}${text}`);
}

function formatList(values) {
  if (!values.length) {
    return "none detected";
  }

  return values.join(", ");
}

const packageJson = JSON.parse(readFileSafe("package.json") || "{}");
const packageSource = readFileSafe("packages/currency-detection/package.json");
const wxtConfigSource = readFileSafe("wxt.config.ts");
const ratesSource = readFileSafe("apps/extension/utils/rates.ts");
const appStorageSource = readFileSafe("apps/extension/utils/appStorage.ts");
const backgroundSource = readFileSafe("apps/extension/entrypoints/background.ts");
const workflowDirectory = path.join(repoRoot, ".github/workflows");
const workflowFiles = exists(".github/workflows")
  ? fs
    .readdirSync(workflowDirectory)
    .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
    .sort()
  : [];

const permissions = extractStringArrayByKey(wxtConfigSource, "permissions");
const hostPermissions = extractStringArrayByKey(wxtConfigSource, "host_permissions");
const rateProviders = extractRateProviderUrls(ratesSource);
const settingsKey = extractMatch(
  appStorageSource,
  /const SETTINGS_KEY = "([^"]+)"/,
);
const rateCacheKey = extractMatch(ratesSource, /const RATE_CACHE_KEY = "([^"]+)"/);
const rateRefreshIntervalMinutes = extractMatch(
  backgroundSource,
  /const RATE_REFRESH_INTERVAL_MINUTES = (\d+)/,
);
const feedbackUrl = extractMatch(
  readFileSafe("apps/extension/entrypoints/popup/App.tsx"),
  /const FEEDBACK_URL = "([^"]+)"/,
);
const currencyDetectionPackage = packageSource
  ? JSON.parse(packageSource)
  : null;

const hasExtensionApp = exists("apps/extension");
const hasBackgroundWorker = exists("apps/extension/entrypoints/background.ts");
const hasPopupUi = exists("apps/extension/entrypoints/popup/App.tsx");
const hasOptionsPage = exists("apps/extension/entrypoints/options/App.tsx");
const hasContentRuntime = exists("apps/extension/entrypoints/content/index.tsx");
const hasSelectionPopupLoader = exists(
  "apps/extension/entrypoints/content/selectionPopupLoader.ts",
);
const hasSelectionPopup = exists("apps/extension/entrypoints/content/selectionPopup.ts");
const hasContentConversionRuntime = exists(
  "apps/extension/entrypoints/content/conversionRuntime.ts",
);
const hasInlineConversionPipeline = exists(
  "apps/extension/entrypoints/content/inlineConversion.ts",
);
const hasCurrencyParsingUtils = exists("apps/extension/utils/utils.ts");
const hasBrowserStorage = exists("apps/extension/utils/appStorage.ts");
const hasRateClient = exists("apps/extension/utils/rates.ts");
const hasWebsiteApp = exists("apps/website");
const hasLandingPage = exists("apps/website/index.html");
const hasParserPlayground = exists("apps/website/playground.js");
const hasCurrencyDetectionPackage = exists("packages/currency-detection/package.json");
const hasDocs = exists("docs");
const hasCiWorkflows = workflowFiles.length > 0;

const repositoryName = packageJson.name || "FX Inline";
const repositoryVersion = packageJson.version || "0.0.0";
const repositoryDescription =
  packageJson.description || "FX Inline repository workspace.";

const extensionDescription = [
  "WXT + React browser extension under apps/extension.",
  `Core permissions: ${formatList(permissions)}.`,
  `Host permissions: ${formatList(hostPermissions)}.`,
].join(" ");

const browserStorageDescription = [
  "Persists extension state with WXT storage.",
  settingsKey ? `Settings key: ${settingsKey}.` : "",
  rateCacheKey ? `Rate cache key: ${rateCacheKey}.` : "",
].filter(Boolean).join(" ");

const rateClientDescription = [
  "Fetches latest USD-based exchange rates.",
  rateRefreshIntervalMinutes
    ? `Background refresh interval: ${rateRefreshIntervalMinutes} minutes.`
    : "",
  rateProviders.length
    ? `Providers: ${formatList(rateProviders)}.`
    : "",
].filter(Boolean).join(" ");

const websiteDescription =
  "Standalone Vite site in apps/website with a landing page and parser playground.";
const contentRuntimeDescription =
  "Injected content runtime that observes page mutations, parses currency text, and mounts selection UI on demand.";
const ciDescription = hasCiWorkflows
  ? `Workflow files: ${workflowFiles.join(", ")}.`
  : "Repository automation workflows.";
const currencyDetectionDescription = hasCurrencyDetectionPackage
  ? currencyDetectionPackage?.description ||
    "Portable currency parsing package in packages/currency-detection."
  : "Portable currency parsing package.";

const lines = [];

writeLine(
  lines,
  0,
  "// Generated by scripts/generate-likec4-model.mjs. Do not edit directly.",
);
writeLine(lines, 0);
writeLine(lines, 0, "model {");
writeLine(lines, 1, `maintainer = actor ${q("Maintainer")}`);
writeLine(lines, 1, `browser_user = actor ${q("Browser User")}`);
writeLine(lines, 1);
writeLine(lines, 1, `browser_platform = external ${q("Browser Extension Platform")}`);
writeLine(lines, 1, `visited_web_pages = external ${q("Visited Web Pages")}`);

if (rateProviders.length) {
  writeLine(lines, 1, `exchange_rate_providers = external ${q("Exchange Rate Providers")}`);
}

if (feedbackUrl) {
  writeLine(lines, 1, `feedback_form = external ${q("User Feedback Form")}`);
}

if (hasCiWorkflows) {
  writeLine(lines, 1, `github_actions_service = external ${q("GitHub Actions")}`);
}

writeLine(lines, 1);
writeLine(lines, 1, `fx_inline_repository = system ${q(repositoryName)} {`);
writeLine(
  lines,
  2,
  `description ${q(
    `${repositoryDescription} Version ${repositoryVersion}. Auto-generated from package.json, wxt.config.ts, extension entrypoints, website files, package workspace, and workflow metadata.`,
  )}`,
);

if (hasExtensionApp) {
  writeLine(lines, 2, `extension_app = component ${q("Browser Extension App")} {`);
  writeLine(lines, 3, `description ${q(extensionDescription)}`);

  if (hasBackgroundWorker) {
    writeLine(lines, 3, `background_worker = component ${q("Background Worker")}`);
  }

  if (hasPopupUi) {
    writeLine(lines, 3, `popup_ui = component ${q("Popup UI")}`);
  }

  if (hasOptionsPage) {
    writeLine(lines, 3, `options_page = component ${q("Options Page")}`);
  }

  if (hasContentRuntime) {
    writeLine(lines, 3, `content_runtime = component ${q("Content Runtime")} {`);
    writeLine(lines, 4, `description ${q(contentRuntimeDescription)}`);
    writeLine(lines, 4, `content_script = component ${q("Content Script")}`);

    if (hasSelectionPopupLoader) {
      writeLine(
        lines,
        4,
        `selection_popup_loader = component ${q("Selection Popup Loader")}`,
      );
    }

    if (hasSelectionPopup) {
      writeLine(lines, 4, `selection_popup = component ${q("Selection Popup")}`);
    }

    if (hasContentConversionRuntime) {
      writeLine(
        lines,
        4,
        `content_conversion_runtime = component ${q("Content Conversion Runtime")}`,
      );
    }

    if (hasInlineConversionPipeline) {
      writeLine(
        lines,
        4,
        `inline_conversion_pipeline = component ${q("Inline Conversion Pipeline")}`,
      );
    }

    if (hasCurrencyParsingUtils) {
      writeLine(
        lines,
        4,
        `currency_parsing_utils = component ${q("Currency Parsing Utils")}`,
      );
    }

    writeLine(lines, 3, "}");
  }

  if (hasBrowserStorage) {
    writeLine(lines, 3, `browser_storage = component ${q("Browser Storage")} {`);
    writeLine(lines, 4, `description ${q(browserStorageDescription)}`);
    writeLine(lines, 3, "}");
  }

  if (hasRateClient) {
    writeLine(lines, 3, `rate_client = component ${q("Rate Client")} {`);
    writeLine(lines, 4, `description ${q(rateClientDescription)}`);
    writeLine(lines, 3, "}");
  }

  writeLine(lines, 2, "}");
}

if (hasWebsiteApp) {
  writeLine(lines, 2, `website_app = component ${q("Marketing Website")} {`);
  writeLine(lines, 3, `description ${q(websiteDescription)}`);

  if (hasLandingPage) {
    writeLine(lines, 3, `landing_page = component ${q("Landing Page")}`);
  }

  if (hasParserPlayground) {
    writeLine(lines, 3, `parser_playground = component ${q("Parser Playground")}`);
  }

  writeLine(lines, 2, "}");
}

if (hasCurrencyDetectionPackage) {
  writeLine(
    lines,
    2,
    `currency_detection_package = component ${q("Currency Detection Package")} {`,
  );
  writeLine(lines, 3, `description ${q(currencyDetectionDescription)}`);
  writeLine(lines, 2, "}");
}

if (hasDocs) {
  writeLine(lines, 2, `docs_runbooks = component ${q("Docs And Runbooks")}`);
}

if (hasCiWorkflows) {
  writeLine(lines, 2, `ci_workflows = component ${q("CI Workflows")} {`);
  writeLine(lines, 3, `description ${q(ciDescription)}`);
  writeLine(lines, 2, "}");
}

writeLine(lines, 2);

if (hasExtensionApp && hasPopupUi && hasBrowserStorage) {
  writeLine(
    lines,
    2,
    `extension_app.popup_ui -> extension_app.browser_storage ${q("read and update user settings")}`,
  );
}

if (hasExtensionApp && hasPopupUi && hasOptionsPage) {
  writeLine(
    lines,
    2,
    `extension_app.popup_ui -> extension_app.options_page ${q("open extension settings")}`,
  );
}

if (hasExtensionApp && hasPopupUi && hasRateClient) {
  writeLine(
    lines,
    2,
    `extension_app.popup_ui -> extension_app.rate_client ${q("load cached exchange rates")}`,
  );
}

if (hasExtensionApp && hasOptionsPage && hasBrowserStorage) {
  writeLine(
    lines,
    2,
    `extension_app.options_page -> extension_app.browser_storage ${q("persist preferred currency")}`,
  );
}

if (hasExtensionApp && hasBackgroundWorker && hasRateClient) {
  writeLine(
    lines,
    2,
    `extension_app.background_worker -> extension_app.rate_client ${q("refresh exchange rates")}`,
  );
}

if (hasExtensionApp && hasBackgroundWorker && hasBrowserStorage) {
  writeLine(
    lines,
    2,
    `extension_app.background_worker -> extension_app.browser_storage ${q("cache latest rate snapshot")}`,
  );
}

if (hasExtensionApp && hasRateClient && hasBrowserStorage) {
  writeLine(
    lines,
    2,
    `extension_app.rate_client -> extension_app.browser_storage ${q("read and write rate cache")}`,
  );
}

if (hasContentRuntime) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.content_script -> visited_web_pages ${q("observe DOM and capture selections")}`,
  );
}

if (hasContentRuntime && hasSelectionPopupLoader) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.content_script -> extension_app.content_runtime.selection_popup_loader ${q("load popup UI on demand")}`,
  );
}

if (hasContentRuntime && hasContentConversionRuntime) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.content_script -> extension_app.content_runtime.content_conversion_runtime ${q("initialize inline conversion runtime")}`,
  );
}

if (hasContentRuntime && hasCurrencyParsingUtils) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.content_script -> extension_app.content_runtime.currency_parsing_utils ${q("parse selected text")}`,
  );
}

if (hasContentRuntime && hasSelectionPopupLoader && hasSelectionPopup) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.selection_popup_loader -> extension_app.content_runtime.selection_popup ${q("hydrate popup controller and styles")}`,
  );
}

if (hasContentRuntime && hasSelectionPopup && hasBrowserStorage) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.selection_popup -> extension_app.browser_storage ${q("read settings and rates")}`,
  );
}

if (hasContentRuntime && hasContentConversionRuntime && hasInlineConversionPipeline) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.content_conversion_runtime -> extension_app.content_runtime.inline_conversion_pipeline ${q("run full and partial conversion passes")}`,
  );
}

if (hasContentRuntime && hasContentConversionRuntime && hasBrowserStorage) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.content_conversion_runtime -> extension_app.browser_storage ${q("hydrate settings and rate cache")}`,
  );
}

if (hasContentRuntime && hasInlineConversionPipeline && hasCurrencyParsingUtils) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.inline_conversion_pipeline -> extension_app.content_runtime.currency_parsing_utils ${q("extract currency matches from text and DOM")}`,
  );
}

if (hasContentRuntime && hasInlineConversionPipeline) {
  writeLine(
    lines,
    2,
    `extension_app.content_runtime.inline_conversion_pipeline -> visited_web_pages ${q("decorate detected prices in the page DOM")}`,
  );
}

if (hasWebsiteApp && hasParserPlayground && hasCurrencyDetectionPackage) {
  writeLine(
    lines,
    2,
    `website_app.parser_playground -> currency_detection_package ${q("import parser API for interactive demos")}`,
  );
}

writeLine(lines, 1, "}");
writeLine(lines, 1);
writeLine(
  lines,
  1,
  `maintainer -> fx_inline_repository ${q("maintains the workspace and release automation")}`,
);
writeLine(
  lines,
  1,
  `browser_user -> visited_web_pages ${q("browse price-heavy pages")}`,
);

if (hasExtensionApp && hasPopupUi) {
  writeLine(
    lines,
    1,
    `browser_user -> fx_inline_repository.extension_app.popup_ui ${q("open the toolbar popup")}`,
  );
}

if (hasExtensionApp && hasOptionsPage) {
  writeLine(
    lines,
    1,
    `browser_user -> fx_inline_repository.extension_app.options_page ${q("change preferred currency settings")}`,
  );
}

if (hasWebsiteApp && hasLandingPage) {
  writeLine(
    lines,
    1,
    `browser_user -> fx_inline_repository.website_app.landing_page ${q("visit the product website")}`,
  );
}

if (hasWebsiteApp && hasParserPlayground) {
  writeLine(
    lines,
    1,
    `browser_user -> fx_inline_repository.website_app.parser_playground ${q("test parser behavior in the playground")}`,
  );
}

if (hasExtensionApp && hasBackgroundWorker) {
  writeLine(
    lines,
    1,
    `browser_platform -> fx_inline_repository.extension_app.background_worker ${q("dispatch startup, install, and alarm events")}`,
  );
}

if (hasExtensionApp && hasPopupUi) {
  writeLine(
    lines,
    1,
    `browser_platform -> fx_inline_repository.extension_app.popup_ui ${q("host extension action UI")}`,
  );
}

if (hasExtensionApp && hasOptionsPage) {
  writeLine(
    lines,
    1,
    `browser_platform -> fx_inline_repository.extension_app.options_page ${q("host extension options UI")}`,
  );
}

if (hasContentRuntime) {
  writeLine(
    lines,
    1,
    `browser_platform -> fx_inline_repository.extension_app.content_runtime.content_script ${q("inject on matching pages")}`,
  );
}

if (hasRateClient && rateProviders.length) {
  writeLine(
    lines,
    1,
    `fx_inline_repository.extension_app.rate_client -> exchange_rate_providers ${q("fetch latest USD exchange rates")}`,
  );
}

if (hasPopupUi && feedbackUrl) {
  writeLine(
    lines,
    1,
    `fx_inline_repository.extension_app.popup_ui -> feedback_form ${q("open feedback collection flow")}`,
  );
}

if (hasCiWorkflows) {
  writeLine(
    lines,
    1,
    `fx_inline_repository.ci_workflows -> github_actions_service ${q("execute workflow runs")}`,
  );
}

writeLine(lines, 0, "}");
writeLine(lines, 0);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}`, "utf8");
process.stdout.write(`Generated ${path.relative(repoRoot, outputPath)}\n`);
