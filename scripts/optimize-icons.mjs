import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const extensionIconDirectory = path.join("apps", "extension", "public", "icon");
export const storeListingIconPath = path.join(
  "apps",
  "extension",
  "store-assets",
  "icon-512.png",
);

export const extensionIcons = [
  { size: 16, path: path.join(extensionIconDirectory, "16.png"), maxBytes: 780 },
  { size: 32, path: path.join(extensionIconDirectory, "32.png"), maxBytes: 1_800 },
  { size: 48, path: path.join(extensionIconDirectory, "48.png"), maxBytes: 3_200 },
  { size: 128, path: path.join(extensionIconDirectory, "128.png"), maxBytes: 12_500 },
];

export const storeListingIcon = {
  size: 512,
  path: storeListingIconPath,
  maxBytes: 80_000,
};

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listExistingBuildIconDirectories() {
  const outputDirectory = ".output";

  if (!(await pathExists(outputDirectory))) {
    return [];
  }

  const entries = await fs.readdir(outputDirectory, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(outputDirectory, entry.name, "icon"));

  const existingDirectories = [];
  for (const directory of directories) {
    if (await pathExists(directory)) {
      existingDirectories.push(directory);
    }
  }

  return existingDirectories;
}

async function listPngFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => entry.name.endsWith(".png"))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function runOxipng(files, { useZopfli }) {
  if (files.length === 0) return;

  const compressionArgs = useZopfli ? ["--zopfli"] : [];
  const result = spawnSync(
    getNpmCommand(),
    [
      "exec",
      "--",
      "oxipng",
      "--opt",
      "max",
      ...compressionArgs,
      "--strip",
      "all",
      "--alpha",
      "--interlace",
      "0",
      ...files,
    ],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    throw new Error(`oxipng failed with exit code ${result.status}.`);
  }
}

async function readPngStats(icon) {
  const file = await fs.readFile(icon.path);

  if (!file.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error(`${icon.path} is not a valid PNG file.`);
  }

  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);

  return {
    bytes: file.byteLength,
    height,
    width,
  };
}

async function assertIcon(icon) {
  const stats = await readPngStats(icon);

  if (stats.width !== icon.size || stats.height !== icon.size) {
    throw new Error(
      `${icon.path} must be ${icon.size}x${icon.size}; found ${stats.width}x${stats.height}.`,
    );
  }

  if (stats.bytes > icon.maxBytes) {
    throw new Error(
      `${icon.path} is ${stats.bytes} bytes; expected at most ${icon.maxBytes} bytes.`,
    );
  }

  return stats;
}

async function assertExtensionPublicIconSet() {
  const publicIcon512Path = path.join(extensionIconDirectory, "512.png");
  if (await pathExists(publicIcon512Path)) {
    throw new Error(
      `${publicIcon512Path} must stay out of the extension public directory; keep the 512 listing icon at ${storeListingIconPath}.`,
    );
  }

  const publicIcons = await listPngFiles(extensionIconDirectory);
  const expectedIcons = extensionIcons.map((icon) => icon.path);

  const unexpectedIcons = publicIcons.filter((iconPath) => !expectedIcons.includes(iconPath));
  if (unexpectedIcons.length > 0) {
    throw new Error(`Unexpected extension public icon files: ${unexpectedIcons.join(", ")}.`);
  }
}

async function assertBuildOutputIconSets() {
  const buildIconDirectories = await listExistingBuildIconDirectories();

  for (const directory of buildIconDirectories) {
    const output512Path = path.join(directory, "512.png");
    if (await pathExists(output512Path)) {
      throw new Error(`${output512Path} must not be packaged in extension output.`);
    }
  }
}

export async function assertIconAssets() {
  await assertExtensionPublicIconSet();

  const icons = [...extensionIcons, storeListingIcon];
  const stats = [];
  for (const icon of icons) {
    stats.push({ icon, stats: await assertIcon(icon) });
  }

  await assertBuildOutputIconSets();
  return stats;
}

async function optimizeSourceIcons() {
  runOxipng([...extensionIcons.map((icon) => icon.path), storeListingIcon.path], {
    useZopfli: true,
  });
}

async function optimizeBuildOutputIcons() {
  const buildIconDirectories = await listExistingBuildIconDirectories();
  const buildIconFiles = [];

  for (const directory of buildIconDirectories) {
    buildIconFiles.push(...(await listPngFiles(directory)));
  }

  runOxipng(buildIconFiles, { useZopfli: false });
}

function parseArgs(args) {
  const requestedActions = new Set(args);

  if (requestedActions.size === 0) {
    requestedActions.add("--source");
    requestedActions.add("--check");
  }

  for (const action of requestedActions) {
    if (!["--source", "--build-output", "--check"].includes(action)) {
      throw new Error(`Unknown icon optimization option: ${action}.`);
    }
  }

  return requestedActions;
}

function formatStats(stats) {
  return stats
    .map(({ icon, stats: iconStats }) => {
      const label = icon.size === 512 ? "store-listing 512" : `extension ${icon.size}`;
      return `${label}: ${iconStats.bytes} bytes`;
    })
    .join("\n");
}

async function main() {
  const actions = parseArgs(process.argv.slice(2));

  if (actions.has("--source")) {
    await optimizeSourceIcons();
  }

  if (actions.has("--build-output")) {
    await optimizeBuildOutputIcons();
  }

  if (actions.has("--check")) {
    const stats = await assertIconAssets();
    process.stdout.write(`${formatStats(stats)}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
