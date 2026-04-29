import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

export const DEFAULT_EXTENSION_BUILD_DIR = ".output/chrome-mv3";
export const DEFAULT_EXTENSION_ASSET_DIR = "apps/extension/public";

export const BUILD_POLICY = {
  byteBudgets: {
    totalBuild: 725 * 1024,
    backgroundScript: 25 * 1024,
    contentScript: 130 * 1024,
    htmlEntryChunk: 110 * 1024,
    sharedChunk: 235 * 1024,
    cssFile: 16 * 1024,
    totalPngAssets: 150 * 1024,
    pngAssetsByPath: {
      "icon/16.png": 800,
      "icon/32.png": 2_100,
      "icon/48.png": 3_600,
      "icon/96.png": 9_500,
      "icon/128.png": 14_000,
      "icon/512.png": 115_000,
    },
  },
  cssDuplication: {
    gramLength: 80,
    nearDuplicateOverlap: 0.95,
    knownNearDuplicatePairs: [
      {
        labels: ["options", "popup"],
        maxOverlap: 0.995,
      },
      {
        labels: ["options", "welcome"],
        maxOverlap: 0.995,
      },
    ],
  },
  requiredChunkPrefixes: [
    "browser-runtime",
    "currency-catalog",
    "extension-storage",
    "vendor-react",
  ],
  forbiddenManifestStrings: [
    "Default Popup Title",
    "Default Extension",
    "Extension Name",
    "New Extension",
    "WXT + React",
  ],
};

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;

  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export async function findBuildPolicyViolations({
  buildDir = DEFAULT_EXTENSION_BUILD_DIR,
  policy = BUILD_POLICY,
} = {}) {
  const files = await collectFiles(buildDir);
  const violations = [];

  violations.push(...(await findManifestViolations({ buildDir, policy })));
  violations.push(...(await findHtmlPlaceholderViolations({ buildDir, policy })));
  violations.push(...findBundleSizeViolations({ files, policy }));
  violations.push(...(await findCssDuplicationViolations({ buildDir, files, policy })));
  violations.push(...findRequiredChunkViolations({ files, policy }));

  return violations;
}

export async function optimizeExtensionAssets({
  assetDir = DEFAULT_EXTENSION_ASSET_DIR,
  write = false,
} = {}) {
  const files = await collectFiles(assetDir);
  const pngFiles = files.filter((file) => file.relativePath.endsWith(".png"));
  const results = [];

  for (const file of pngFiles) {
    const source = await fs.readFile(file.absolutePath);
    const optimized = optimizePngBuffer(source);
    const savedBytes = source.length - optimized.length;

    if (savedBytes > 0 && write) {
      await fs.writeFile(file.absolutePath, optimized);
    }

    results.push({
      absolutePath: file.absolutePath,
      relativePath: file.relativePath,
      originalBytes: source.length,
      optimizedBytes: optimized.length,
      savedBytes,
      changed: savedBytes > 0,
    });
  }

  return results;
}

export function optimizePngBuffer(source) {
  if (!source.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return source;
  }

  const chunks = parsePngChunks(source);
  const idatChunks = chunks.filter((chunk) => chunk.type === "IDAT");

  if (idatChunks.length === 0) {
    return source;
  }

  const imageData = Buffer.concat(idatChunks.map((chunk) => chunk.data));
  const inflatedImageData = zlib.inflateSync(imageData);
  const optimizedImageData = zlib.deflateSync(inflatedImageData, { level: 9 });
  const rebuiltChunks = [];
  let wroteOptimizedImageData = false;

  for (const chunk of chunks) {
    if (chunk.type === "IDAT") {
      if (!wroteOptimizedImageData) {
        rebuiltChunks.push(writePngChunk("IDAT", optimizedImageData));
        wroteOptimizedImageData = true;
      }

      continue;
    }

    rebuiltChunks.push(writePngChunk(chunk.type, chunk.data));
  }

  const optimized = Buffer.concat([PNG_SIGNATURE, ...rebuiltChunks]);

  return optimized.length < source.length ? optimized : source;
}

async function collectFiles(rootDir) {
  const files = [];

  async function visit(currentDir, relativeDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = path.posix.join(relativeDir, entry.name);
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
        continue;
      }

      if (!entry.isFile()) continue;

      const stats = await fs.stat(absolutePath);
      files.push({
        absolutePath,
        relativePath,
        bytes: stats.size,
      });
    }
  }

  await visit(rootDir, "");

  return files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

async function findManifestViolations({ buildDir, policy }) {
  const manifestPath = path.join(buildDir, "manifest.json");
  const manifestText = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const strings = collectJsonStrings(manifest);
  const violations = [];

  for (const { jsonPath, value } of strings) {
    for (const forbiddenValue of policy.forbiddenManifestStrings) {
      if (value.includes(forbiddenValue)) {
        violations.push({
          id: "forbidden-manifest-default",
          message: `manifest.json ${jsonPath} contains scaffold value "${forbiddenValue}".`,
        });
      }
    }
  }

  return violations;
}

async function findHtmlPlaceholderViolations({ buildDir, policy }) {
  const files = await collectFiles(buildDir);
  const htmlFiles = files.filter((file) => file.relativePath.endsWith(".html"));
  const violations = [];

  for (const file of htmlFiles) {
    const html = await fs.readFile(file.absolutePath, "utf8");

    for (const forbiddenValue of policy.forbiddenManifestStrings) {
      if (html.includes(forbiddenValue)) {
        violations.push({
          id: "forbidden-html-placeholder",
          message: `${file.relativePath} contains scaffold value "${forbiddenValue}".`,
        });
      }
    }
  }

  return violations;
}

function findBundleSizeViolations({ files, policy }) {
  const violations = [];
  const totalBuildBytes = sumBytes(files);

  if (totalBuildBytes > policy.byteBudgets.totalBuild) {
    violations.push({
      id: "total-build-size",
      message: `Extension build is ${formatBytes(totalBuildBytes)}, above ${formatBytes(policy.byteBudgets.totalBuild)}.`,
    });
  }

  for (const file of files) {
    if (file.relativePath === "background.js") {
      pushBudgetViolation({
        violations,
        id: "background-size",
        file,
        maxBytes: policy.byteBudgets.backgroundScript,
      });
      continue;
    }

    if (
      file.relativePath.startsWith("content-scripts/") &&
      file.relativePath.endsWith(".js")
    ) {
      pushBudgetViolation({
        violations,
        id: "content-script-size",
        file,
        maxBytes: policy.byteBudgets.contentScript,
      });
      continue;
    }

    if (file.relativePath.startsWith("chunks/") && file.relativePath.endsWith(".js")) {
      const isHtmlEntryChunk = /\/(options|popup|welcome)-/.test(file.relativePath);
      pushBudgetViolation({
        violations,
        id: isHtmlEntryChunk ? "html-entry-chunk-size" : "shared-chunk-size",
        file,
        maxBytes: isHtmlEntryChunk
          ? policy.byteBudgets.htmlEntryChunk
          : policy.byteBudgets.sharedChunk,
      });
      continue;
    }

    if (file.relativePath.startsWith("assets/") && file.relativePath.endsWith(".css")) {
      pushBudgetViolation({
        violations,
        id: "css-file-size",
        file,
        maxBytes: policy.byteBudgets.cssFile,
      });
      continue;
    }
  }

  const pngFiles = files.filter((file) => file.relativePath.endsWith(".png"));
  const totalPngBytes = sumBytes(pngFiles);

  if (totalPngBytes > policy.byteBudgets.totalPngAssets) {
    violations.push({
      id: "total-png-size",
      message: `PNG assets total ${formatBytes(totalPngBytes)}, above ${formatBytes(policy.byteBudgets.totalPngAssets)}.`,
    });
  }

  for (const [relativePath, maxBytes] of Object.entries(
    policy.byteBudgets.pngAssetsByPath,
  )) {
    const file = files.find((candidate) => candidate.relativePath === relativePath);

    if (!file) continue;

    pushBudgetViolation({
      violations,
      id: "png-asset-size",
      file,
      maxBytes,
    });
  }

  return violations;
}

async function findCssDuplicationViolations({ buildDir, files, policy }) {
  const cssFiles = files.filter((file) => file.relativePath.endsWith(".css"));
  const cssLabelsByPath = await labelCssAssetsByHtmlEntry(buildDir);
  const knownNearDuplicatePairs = policy.cssDuplication.knownNearDuplicatePairs.map(
    (pair) => ({
      key: cssPairKey(pair.labels),
      maxOverlap: pair.maxOverlap,
    }),
  );
  const violations = [];
  const cssEntries = [];

  for (const file of cssFiles) {
    const text = await fs.readFile(file.absolutePath, "utf8");
    const normalized = normalizeCss(text);

    cssEntries.push({
      ...file,
      label: cssLabelsByPath.get(file.relativePath) ?? file.relativePath,
      normalized,
      hash: createHash("sha256").update(normalized).digest("hex"),
      grams: cssGrams(normalized, policy.cssDuplication.gramLength),
    });
  }

  for (let leftIndex = 0; leftIndex < cssEntries.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < cssEntries.length;
      rightIndex += 1
    ) {
      const left = cssEntries[leftIndex];
      const right = cssEntries[rightIndex];

      if (left.hash === right.hash) {
        violations.push({
          id: "duplicate-css",
          message: `${left.relativePath} and ${right.relativePath} have identical normalized CSS.`,
        });
        continue;
      }

      const overlap = cssOverlap(left.grams, right.grams);

      if (overlap < policy.cssDuplication.nearDuplicateOverlap) continue;

      const knownPair = knownNearDuplicatePairs.find(
        (pair) => pair.key === cssPairKey([left.label, right.label]),
      );

      if (knownPair && overlap <= knownPair.maxOverlap) continue;

      violations.push({
        id: "near-duplicate-css",
        message: `${left.relativePath} and ${right.relativePath} share ${(overlap * 100).toFixed(1)}% of their CSS chunks.`,
      });
    }
  }

  return violations;
}

function findRequiredChunkViolations({ files, policy }) {
  const chunkFiles = files
    .filter((file) => file.relativePath.startsWith("chunks/"))
    .map((file) => path.posix.basename(file.relativePath));
  const violations = [];

  for (const requiredPrefix of policy.requiredChunkPrefixes) {
    const hasChunk = chunkFiles.some((fileName) =>
      fileName.startsWith(`${requiredPrefix}-`),
    );

    if (!hasChunk) {
      violations.push({
        id: "missing-manual-chunk",
        message: `Expected manual chunk prefix "${requiredPrefix}" in extension output.`,
      });
    }
  }

  return violations;
}

async function labelCssAssetsByHtmlEntry(buildDir) {
  const labelsByPath = new Map();
  const files = await collectFiles(buildDir);
  const htmlFiles = files.filter((file) => file.relativePath.endsWith(".html"));

  for (const file of htmlFiles) {
    const html = await fs.readFile(file.absolutePath, "utf8");
    const label = path.posix.basename(file.relativePath, ".html");
    const hrefMatches = html.matchAll(/href="\/?(assets\/[^"]+\.css)"/g);

    for (const hrefMatch of hrefMatches) {
      labelsByPath.set(hrefMatch[1], label);
    }
  }

  return labelsByPath;
}

function collectJsonStrings(value, jsonPath = "$") {
  if (typeof value === "string") {
    return [{ jsonPath, value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectJsonStrings(item, `${jsonPath}[${index}]`),
    );
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectJsonStrings(item, `${jsonPath}.${key}`),
    );
  }

  return [];
}

function pushBudgetViolation({ violations, id, file, maxBytes }) {
  if (file.bytes <= maxBytes) return;

  violations.push({
    id,
    message: `${file.relativePath} is ${formatBytes(file.bytes)}, above ${formatBytes(maxBytes)}.`,
  });
}

function sumBytes(files) {
  return files.reduce((total, file) => total + file.bytes, 0);
}

function normalizeCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cssGrams(css, gramLength) {
  const grams = new Set();

  for (let index = 0; index < css.length; index += gramLength) {
    grams.add(css.slice(index, index + gramLength));
  }

  return grams;
}

function cssOverlap(leftGrams, rightGrams) {
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;

  let shared = 0;

  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) {
      shared += 1;
    }
  }

  return shared / Math.min(leftGrams.size, rightGrams.size);
}

function cssPairKey(labels) {
  return labels.toSorted().join("|");
}

function parsePngChunks(source) {
  const chunks = [];
  let offset = PNG_SIGNATURE.length;

  while (offset < source.length) {
    const dataLength = source.readUInt32BE(offset);
    const type = source.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + dataLength;

    chunks.push({
      type,
      data: source.subarray(dataStart, dataEnd),
    });

    offset = dataEnd + 4;

    if (type === "IEND") break;
  }

  return chunks;
}

function writePngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);

  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);

  return chunk;
}

function crc32(data) {
  let value = 0xffffffff;

  for (const byte of data) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}
