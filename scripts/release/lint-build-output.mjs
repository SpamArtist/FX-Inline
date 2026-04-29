import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_TITLE = "FX Inline";
const DEFAULT_OUTPUT_ROOT = ".output";

const DISALLOWED_TEXT = [
  {
    label: "WXT scaffold popup title",
    value: "Default Popup Title",
  },
  {
    label: "1970 generatedAt sentinel",
    value: "1970-01-01T00:00:00.000Z",
  },
];

const DEFAULT_SOURCE_FILES = [
  "apps/extension/entrypoints/popup/index.html",
  "apps/extension/generated/inlineRuntimeSettingsManifest.ts",
  "apps/extension/utils/inlineRuntimeSettings.ts",
  "apps/admin/src/settingsConstants.js",
  "apps/backend/src/settings-store.ts",
  "wxt.config.ts",
];

const TEXT_FILE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".svg",
  ".txt",
]);
const ORPHAN_CANDIDATE_EXTENSIONS = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);
const REFERENCED_FILE_PATTERN =
  /(?:^|["'(\s])\/?([A-Za-z0-9._/-]+\.(?:css|gif|html|jpe?g|js|png|svg|webp))(?:[#?][^"'()\s]*)?/giu;
const BROWSER_SHIM_PATTERN = /^chunks\/browser-[A-Za-z0-9_-]+\.js$/u;

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function normalizeRelativeReference(value) {
  if (!value || /^[a-z][a-z0-9+.-]*:/iu.test(value)) return null;

  const [withoutHash] = value.split("#");
  const [withoutQuery] = withoutHash.split("?");
  const normalized = withoutQuery
    .replace(/\\/gu, "/")
    .replace(/^\/+/u, "")
    .replace(/^\.\//u, "");

  return normalized || null;
}

function normalizeTextReference(value, fileDirectory) {
  if (!value || /^[a-z][a-z0-9+.-]*:/iu.test(value)) return null;

  const [withoutHash] = value.split("#");
  const [withoutQuery] = withoutHash.split("?");
  const normalized = withoutQuery.replace(/\\/gu, "/");

  if (normalized.startsWith("./") || normalized.startsWith("../")) {
    return path.posix.normalize(path.posix.join(fileDirectory, normalized));
  }

  return normalizeRelativeReference(normalized);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(rootDirectory, currentDirectory = rootDirectory) {
  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(rootDirectory, entryPath));
      continue;
    }

    if (!entry.isFile()) continue;
    files.push(toPosixPath(path.relative(rootDirectory, entryPath)));
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function addManifestReferences(value, references) {
  if (typeof value === "string") {
    const reference = normalizeRelativeReference(value);
    if (reference) references.add(reference);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) addManifestReferences(item, references);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const item of Object.values(value)) {
    addManifestReferences(item, references);
  }
}

function addTextReferences(content, references, fileDirectory) {
  for (const match of content.matchAll(REFERENCED_FILE_PATTERN)) {
    const reference = normalizeTextReference(match[1], fileDirectory);
    if (reference) references.add(reference);
  }
}

function findDisallowedText(content, fileLabel) {
  return DISALLOWED_TEXT
    .filter((entry) => content.includes(entry.value))
    .map((entry) => `${fileLabel} contains ${entry.label} (${entry.value}).`);
}

async function readTextIfSupported(filePath) {
  if (!TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return null;
  }

  return fs.readFile(filePath, "utf8");
}

function validateManifest(manifest, manifestLabel) {
  const errors = [];
  const action = manifest.action;

  if (action && action.default_popup && action.default_title !== RELEASE_TITLE) {
    errors.push(
      `${manifestLabel} action.default_title must be "${RELEASE_TITLE}" for release builds.`,
    );
  }

  if (manifest.icons && Object.prototype.hasOwnProperty.call(manifest.icons, "96")) {
    errors.push(`${manifestLabel} must not include the nonessential 96px icon.`);
  }

  if (manifest.icons && Object.values(manifest.icons).includes("icon/96.png")) {
    errors.push(`${manifestLabel} must not reference icon/96.png.`);
  }

  return errors;
}

async function lintSourceFiles(cwd, sourceFiles) {
  const errors = [];

  for (const sourceFile of sourceFiles) {
    const sourcePath = path.resolve(cwd, sourceFile);
    if (!await pathExists(sourcePath)) continue;
    const content = await fs.readFile(sourcePath, "utf8");
    errors.push(...findDisallowedText(content, sourceFile));
  }

  return errors;
}

async function lintBuildDirectory(buildDirectory) {
  const errors = [];
  const manifestPath = path.join(buildDirectory, "manifest.json");
  const manifestLabel = toPosixPath(path.relative(process.cwd(), manifestPath));
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const references = new Set();
  const files = await collectFiles(buildDirectory);

  addManifestReferences(manifest, references);
  errors.push(...validateManifest(manifest, manifestLabel));

  for (const file of files) {
    const filePath = path.join(buildDirectory, file);
    const content = await readTextIfSupported(filePath);
    if (content === null) continue;

    addTextReferences(content, references, path.posix.dirname(file));
    errors.push(...findDisallowedText(content, toPosixPath(path.relative(process.cwd(), filePath))));
  }

  const orphanedAssets = files.filter((file) => {
    const extension = path.extname(file).toLowerCase();
    return ORPHAN_CANDIDATE_EXTENSIONS.has(extension) && !references.has(file);
  });

  if (orphanedAssets.length > 0) {
    errors.push(
      `Found orphaned copied image assets in ${toPosixPath(path.relative(process.cwd(), buildDirectory))}: ${orphanedAssets.join(", ")}.`,
    );
  }

  const tinyBrowserShims = files.filter((file) => BROWSER_SHIM_PATTERN.test(file));
  const orphanedBrowserShims = [];

  for (const file of tinyBrowserShims) {
    const stats = await fs.stat(path.join(buildDirectory, file));
    if (stats.size <= 128 && !references.has(file)) {
      orphanedBrowserShims.push(file);
    }
  }

  if (orphanedBrowserShims.length > 0) {
    errors.push(
      `Found orphaned tiny browser shim chunks in ${toPosixPath(path.relative(process.cwd(), buildDirectory))}: ${orphanedBrowserShims.join(", ")}.`,
    );
  }

  return errors;
}

async function findBuildDirectories(outputRoot) {
  const entries = await fs.readdir(outputRoot, { withFileTypes: true });
  const buildDirectories = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const buildDirectory = path.join(outputRoot, entry.name);
    if (await pathExists(path.join(buildDirectory, "manifest.json"))) {
      buildDirectories.push(buildDirectory);
    }
  }

  return buildDirectories.sort((left, right) => left.localeCompare(right));
}

export async function lintBuildOutput({
  cwd = process.cwd(),
  outputRoot = DEFAULT_OUTPUT_ROOT,
  sourceFiles = DEFAULT_SOURCE_FILES,
} = {}) {
  const resolvedOutputRoot = path.resolve(cwd, outputRoot);
  const errors = await lintSourceFiles(cwd, sourceFiles);

  if (!await pathExists(resolvedOutputRoot)) {
    throw new Error(`Release build output root was not found: ${resolvedOutputRoot}`);
  }

  const buildDirectories = await findBuildDirectories(resolvedOutputRoot);

  if (buildDirectories.length === 0) {
    throw new Error(`No extension build directories with manifest.json were found in ${resolvedOutputRoot}.`);
  }

  for (const buildDirectory of buildDirectories) {
    errors.push(...await lintBuildDirectory(buildDirectory));
  }

  if (errors.length > 0) {
    throw new Error(`Release build lint failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    buildDirectories,
    outputRoot: resolvedOutputRoot,
  };
}

function parseArgs(argv) {
  const options = {
    outputRoot: DEFAULT_OUTPUT_ROOT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg !== "--output-root") continue;

    const value = argv[index + 1];
    if (!value) {
      throw new Error("--output-root requires a value.");
    }

    options.outputRoot = value;
    index += 1;
  }

  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await lintBuildOutput(parseArgs(process.argv.slice(2)));
  const directories = result.buildDirectories
    .map((directory) => toPosixPath(path.relative(process.cwd(), directory)))
    .join(", ");

  process.stdout.write(`Release build lint passed for ${directories}.\n`);
}
