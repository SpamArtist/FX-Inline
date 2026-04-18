#!/usr/bin/env node

import { builtinModules } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDirectory, "..");
const modelOutputPath = path.join(
  repoRoot,
  "architecture/likec4/generated/model.c4",
);
const viewsOutputPath = path.join(repoRoot, "architecture/likec4/views.c4");

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".c4",
  ".likec4",
]);
const CONFIG_EXTENSIONS = new Set([".json", ".yml", ".yaml", ".toml"]);
const DOC_EXTENSIONS = new Set([".md", ".jsonl"]);
const SUPPORT_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
]);
const GENERATED_DIRECTORY_NAMES = new Set([
  "dist",
  "build",
  "test-dist",
  ".wxt",
  ".output",
  "coverage",
  "node_modules",
]);
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".idea",
  ".vscode",
  ".cache",
  ".turbo",
]);
const EXCLUDED_RELATIVE_DIRECTORIES = new Set([
  "architecture/likec4/generated",
]);
const ROOT_CONFIG_FILES = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "wxt.config.ts",
  "eslint.config.mjs",
  "jest.config.cjs",
  "jest.content.config.cjs",
]);
const RESERVED_IDS = new Set([
  "actor",
  "component",
  "description",
  "element",
  "external",
  "group",
  "icon",
  "include",
  "link",
  "model",
  "public",
  "shape",
  "specification",
  "style",
  "system",
  "title",
  "view",
  "views",
]);
const LOW_SIGNAL_FILE_STEMS = [
  /\.types?$/i,
  /\.d$/i,
  /^style$/i,
  /^styles$/i,
  /^constants?$/i,
  /^fixtures?$/i,
  /^content$/i,
];
const GENERIC_FILE_NAME_LABELS = new Map([
  ["index", "Entrypoint"],
  ["main", "Runtime"],
  ["app", "App"],
]);
const BUILTIN_MODULES = new Set(
  builtinModules.map((moduleName) => moduleName.replace(/^node:/, "")),
);
const MAX_FILE_NODES_PER_DIRECTORY = 6;
const MAX_GENERATED_DETAIL_VIEWS = 12;

const categoryPriority = new Map([
  ["workflow", 0],
  ["code", 1],
  ["config", 2],
  ["docs", 3],
  ["support", 4],
]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function normalizeAbsolutePath(value) {
  return path.normalize(value);
}

function readFileSafe(relativePath) {
  try {
    return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

function readAbsoluteFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function q(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function writeLine(lines, indentationLevel, text = "") {
  lines.push(`${"  ".repeat(indentationLevel)}${text}`);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function compareByName(first, second) {
  return first.localeCompare(second, undefined, { sensitivity: "base" });
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort(compareByName);
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function stripKnownExtension(fileName) {
  return fileName.replace(
    /\.(?:d\.)?(?:ts|tsx|js|jsx|mjs|cjs|c4|likec4|json|yml|yaml|toml|md|jsonl|html|css|svg|png|jpg|jpeg|gif)$/i,
    "",
  );
}

function humanize(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.toUpperCase() === word && word.length <= 5) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function sanitizeId(value) {
  let normalized = String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();

  if (!normalized) {
    return "node";
  }

  if (/^[0-9]/.test(normalized)) {
    normalized = `n_${normalized}`;
  }

  if (RESERVED_IDS.has(normalized)) {
    normalized = `node_${normalized}`;
  }

  return normalized;
}

function shouldIgnoreDirectory(relativePath, directoryName) {
  const posixRelativePath = toPosix(relativePath);

  if (EXCLUDED_RELATIVE_DIRECTORIES.has(posixRelativePath)) {
    return true;
  }

  return (
    GENERATED_DIRECTORY_NAMES.has(directoryName) ||
    IGNORED_DIRECTORY_NAMES.has(directoryName)
  );
}

function classifyFile(relativePath, workspaceKind) {
  const posixRelativePath = toPosix(relativePath);
  const fileName = path.basename(posixRelativePath);
  const extension = path.extname(fileName).toLowerCase();

  if (
    posixRelativePath.startsWith(".github/workflows/") &&
    CONFIG_EXTENSIONS.has(extension)
  ) {
    return "workflow";
  }

  if (CODE_EXTENSIONS.has(extension)) {
    return "code";
  }

  if (CONFIG_EXTENSIONS.has(extension)) {
    return "config";
  }

  if (DOC_EXTENSIONS.has(extension)) {
    return "docs";
  }

  if (SUPPORT_EXTENSIONS.has(extension)) {
    return "support";
  }

  if (workspaceKind === "configuration" && ROOT_CONFIG_FILES.has(fileName)) {
    return "config";
  }

  return null;
}

function shouldKeepFileCategory(category, workspaceKind) {
  if (!category) return false;

  if (workspaceKind === "workflow") {
    return category === "workflow" || category === "config" || category === "code";
  }

  if (workspaceKind === "documentation") {
    return category === "docs" || category === "config";
  }

  if (workspaceKind === "configuration") {
    return category === "config" || category === "code";
  }

  if (workspaceKind === "architecture") {
    return category !== null;
  }

  return true;
}

function createFileRecord(relativePath, workspaceKind) {
  const posixRelativePath = toPosix(relativePath);
  const fileName = path.basename(posixRelativePath);
  const category = classifyFile(posixRelativePath, workspaceKind);

  if (!shouldKeepFileCategory(category, workspaceKind)) {
    return null;
  }

  return {
    absPath: normalizeAbsolutePath(path.join(repoRoot, posixRelativePath)),
    relPath: posixRelativePath,
    fileName,
    stem: stripKnownExtension(fileName),
    extension: path.extname(fileName).toLowerCase(),
    category,
  };
}

function collectFilesUnder(relativePath, workspaceKind) {
  const startPath = path.join(repoRoot, relativePath);
  const files = [];

  function visitDirectory(currentRelativePath) {
    const absoluteDirectory = path.join(repoRoot, currentRelativePath);
    const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });

    for (const entry of entries.sort((first, second) => compareByName(first.name, second.name))) {
      const entryRelativePath = currentRelativePath
        ? toPosix(path.join(currentRelativePath, entry.name))
        : entry.name;

      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entryRelativePath, entry.name)) {
          continue;
        }

        visitDirectory(entryRelativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileRecord = createFileRecord(entryRelativePath, workspaceKind);
      if (fileRecord) {
        files.push(fileRecord);
      }
    }
  }

  if (!isDirectory(startPath)) {
    return [];
  }

  visitDirectory(relativePath);
  return files;
}

function discoverRootConfigurationFiles() {
  return Array.from(ROOT_CONFIG_FILES)
    .filter((fileName) => exists(fileName))
    .map((fileName) => createFileRecord(fileName, "configuration"))
    .filter(Boolean);
}

function inferWorkspaceKind(relativePath) {
  const posixRelativePath = toPosix(relativePath);

  if (!posixRelativePath) return "configuration";
  if (posixRelativePath.startsWith("apps/")) return "application";
  if (posixRelativePath.startsWith("packages/")) return "package";
  if (posixRelativePath === "scripts") return "tooling";
  if (posixRelativePath === "docs") return "documentation";
  if (posixRelativePath === "architecture") return "architecture";
  if (posixRelativePath === ".github/workflows") return "workflow";
  return "module";
}

function readWorkspacePackageMeta(relativePath) {
  const packagePath = relativePath
    ? path.join(repoRoot, relativePath, "package.json")
    : path.join(repoRoot, "package.json");

  if (!fs.existsSync(packagePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    return null;
  }
}

function buildWorkspaceLabel(relativePath, workspaceKind, packageMeta) {
  const posixRelativePath = toPosix(relativePath);

  if (!posixRelativePath) {
    return "Repository Configuration";
  }

  if (workspaceKind === "workflow") {
    return "CI Workflows";
  }

  if (workspaceKind === "tooling") {
    return "Repository Scripts";
  }

  if (workspaceKind === "documentation") {
    return "Documentation";
  }

  if (workspaceKind === "architecture") {
    return "Architecture Model";
  }

  if (packageMeta?.name && workspaceKind === "package") {
    return `${humanize(packageMeta.name.split("/").pop())} Package`;
  }

  const name = posixRelativePath.split("/").pop() || posixRelativePath;
  const humanized = humanize(name);

  if (workspaceKind === "application") {
    if (humanized.toLowerCase().includes("extension")) {
      return "Extension App";
    }

    if (humanized.toLowerCase().includes("website")) {
      return "Website App";
    }

    return `${humanized} App`;
  }

  if (workspaceKind === "package") {
    return `${humanized} Package`;
  }

  return humanized;
}

function summarizeCategories(files) {
  const categoryLabels = {
    workflow: ["workflow file", "workflow files"],
    code: ["code file", "code files"],
    config: ["config file", "config files"],
    docs: ["doc file", "doc files"],
    support: ["support file", "support files"],
  };
  const counts = new Map();

  for (const file of files) {
    counts.set(file.category, (counts.get(file.category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([firstCategory], [secondCategory]) => {
      return (categoryPriority.get(firstCategory) ?? 999) -
        (categoryPriority.get(secondCategory) ?? 999);
    })
    .map(([category, count]) => {
      const [singular, plural] = categoryLabels[category] ?? [category, `${category}s`];
      return pluralize(count, singular, plural);
    })
    .join(", ");
}

function buildWorkspaceDescription(workspace, packageMeta) {
  const descriptionParts = [
    `${humanize(workspace.kind)} workspace inferred from ${pluralize(workspace.files.length, "file")} under ${workspace.displayPath}.`,
  ];

  if (packageMeta?.description) {
    descriptionParts.push(packageMeta.description);
  }

  const categorySummary = summarizeCategories(workspace.files);
  if (categorySummary) {
    descriptionParts.push(`Detected: ${categorySummary}.`);
  }

  return descriptionParts.join(" ");
}

function createDirectoryTreeNode(name, relativePath, absolutePath) {
  return {
    name,
    relPath: relativePath,
    absPath: absolutePath,
    files: [],
    children: new Map(),
    totalFiles: 0,
    allFiles: [],
  };
}

function buildDirectoryTree(workspace) {
  const rootRelativePath = workspace.relativePath;
  const rootAbsolutePath = rootRelativePath
    ? path.join(repoRoot, rootRelativePath)
    : repoRoot;
  const rootNode = createDirectoryTreeNode(
    rootRelativePath.split("/").pop() || "",
    rootRelativePath,
    rootAbsolutePath,
  );

  for (const file of workspace.files) {
    const relativeWithinWorkspace = rootRelativePath
      ? path.relative(rootAbsolutePath, file.absPath)
      : file.relPath;
    const segments = toPosix(relativeWithinWorkspace).split("/").filter(Boolean);
    let currentNode = rootNode;

    for (const segment of segments.slice(0, -1)) {
      if (!currentNode.children.has(segment)) {
        const childRelativePath = currentNode.relPath
          ? `${currentNode.relPath}/${segment}`
          : segment;
        currentNode.children.set(
          segment,
          createDirectoryTreeNode(
            segment,
            childRelativePath,
            path.join(repoRoot, childRelativePath),
          ),
        );
      }

      currentNode = currentNode.children.get(segment);
    }

    currentNode.files.push(file);
  }

  function finalize(node) {
    const childNodes = Array.from(node.children.values()).sort((first, second) =>
      compareByName(first.name, second.name),
    );
    let totalFiles = node.files.length;
    let allFiles = [...node.files];

    for (const childNode of childNodes) {
      finalize(childNode);
      totalFiles += childNode.totalFiles;
      allFiles = allFiles.concat(childNode.allFiles);
    }

    node.totalFiles = totalFiles;
    node.allFiles = allFiles;
  }

  finalize(rootNode);
  return rootNode;
}

function discoverWorkspaces() {
  const workspaces = [];
  const topLevelEntries = fs.readdirSync(repoRoot, { withFileTypes: true });

  for (const entry of topLevelEntries.sort((first, second) => compareByName(first.name, second.name))) {
    if (entry.isFile()) {
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    if (shouldIgnoreDirectory(entry.name, entry.name)) {
      continue;
    }

    if (entry.name === "apps" || entry.name === "packages") {
      const namespaceDirectory = path.join(repoRoot, entry.name);
      const namespaceEntries = fs.readdirSync(namespaceDirectory, { withFileTypes: true });

      for (const namespaceEntry of namespaceEntries.sort((first, second) =>
        compareByName(first.name, second.name),
      )) {
        if (!namespaceEntry.isDirectory()) {
          continue;
        }

        const childRelativePath = `${entry.name}/${namespaceEntry.name}`;
        const childKind = inferWorkspaceKind(childRelativePath);
        const files = collectFilesUnder(childRelativePath, childKind);

        if (!files.length) {
          continue;
        }

        const packageMeta = readWorkspacePackageMeta(childRelativePath);
        workspaces.push({
          relativePath: childRelativePath,
          displayPath: childRelativePath,
          kind: childKind,
          files,
          packageMeta,
          label: buildWorkspaceLabel(childRelativePath, childKind, packageMeta),
        });
      }

      continue;
    }

    if (entry.name === ".github") {
      const workflowRelativePath = ".github/workflows";
      const workflowFiles = collectFilesUnder(workflowRelativePath, "workflow");

      if (!workflowFiles.length) {
        continue;
      }

      workspaces.push({
        relativePath: workflowRelativePath,
        displayPath: workflowRelativePath,
        kind: "workflow",
        files: workflowFiles,
        packageMeta: null,
        label: "CI Workflows",
      });
      continue;
    }

    const relativePath = entry.name;
    const workspaceKind = inferWorkspaceKind(relativePath);
    const files = collectFilesUnder(relativePath, workspaceKind);

    if (!files.length) {
      continue;
    }

    const packageMeta = readWorkspacePackageMeta(relativePath);
    workspaces.push({
      relativePath,
      displayPath: relativePath,
      kind: workspaceKind,
      files,
      packageMeta,
      label: buildWorkspaceLabel(relativePath, workspaceKind, packageMeta),
    });
  }

  const configurationFiles = discoverRootConfigurationFiles();
  if (configurationFiles.length) {
    workspaces.unshift({
      relativePath: "",
      displayPath: "repository root",
      kind: "configuration",
      files: configurationFiles,
      packageMeta: readWorkspacePackageMeta(""),
      label: "Repository Configuration",
    });
  }

  return workspaces
    .map((workspace) => {
      const tree = workspace.kind === "configuration"
        ? null
        : buildDirectoryTree(workspace);

      return {
        ...workspace,
        description: buildWorkspaceDescription(workspace, workspace.packageMeta),
        tree,
      };
    })
    .sort((first, second) => {
      if (first.kind === "configuration") return -1;
      if (second.kind === "configuration") return 1;
      return compareByName(first.relativePath, second.relativePath);
    });
}

function buildDirectoryLabel(directoryName, workspaceKind) {
  const normalized = directoryName.toLowerCase();

  if (normalized === "likec4") return "LikeC4";
  if (normalized === "src") return "Source";
  if (normalized === "test") return "Test Suite";
  if (normalized === "tests") return "Tests";
  if (normalized === "utils") return "Utilities";
  if (normalized === "hooks") return "Hooks";
  if (normalized === "entrypoints") return "Entrypoints";
  if (normalized === "components") return "Components";
  if (normalized === "workflows") return "Workflow Definitions";
  if (normalized === "docs") return workspaceKind === "documentation" ? "Documentation" : "Docs";
  if (normalized === "public") return "Public Assets";
  if (normalized === "assets") return "Assets";

  return humanize(directoryName);
}

function buildDirectoryDescription(directoryNode) {
  const categorySummary = summarizeCategories(directoryNode.allFiles);
  return `Inferred from ${pluralize(directoryNode.totalFiles, "file")} under ${directoryNode.relPath}.${categorySummary ? ` Detected: ${categorySummary}.` : ""}`;
}

function shouldSkipFileNode(file) {
  if (file.fileName === "package-lock.json" || file.fileName.endsWith(".d.ts")) {
    return true;
  }

  return LOW_SIGNAL_FILE_STEMS.some((pattern) => pattern.test(file.stem));
}

function isMaterializableFile(file, workspaceKind, hasChildDirectories) {
  if (workspaceKind === "documentation") {
    return file.category === "docs";
  }

  if (workspaceKind === "workflow") {
    return file.category === "workflow" || file.category === "config";
  }

  if (workspaceKind === "configuration") {
    return file.category === "config" || file.category === "code";
  }

  if (workspaceKind === "architecture") {
    return file.category === "code" || file.category === "config" || file.category === "docs";
  }

  if (file.category !== "code" && file.category !== "config") {
    return false;
  }

  if (!hasChildDirectories) {
    return !shouldSkipFileNode(file);
  }

  if (file.category === "config") {
    return true;
  }

  return !shouldSkipFileNode(file);
}

function buildFileLabel(file, parentDirectoryName) {
  const genericLabel = GENERIC_FILE_NAME_LABELS.get(file.stem.toLowerCase());
  if (genericLabel) {
    return `${humanize(parentDirectoryName)} ${genericLabel}`;
  }

  if (/\.test$/i.test(file.stem)) {
    return `${humanize(file.stem.replace(/\.test$/i, ""))} Test`;
  }

  return humanize(file.stem);
}

function createInternalNodeFactory() {
  const allNodes = [];

  function allocateId(parentNode, baseValue) {
    const baseId = sanitizeId(baseValue);
    let candidate = baseId;
    let suffix = 2;

    while (parentNode.childIds.has(candidate)) {
      candidate = `${baseId}_${suffix}`;
      suffix += 1;
    }

    parentNode.childIds.add(candidate);
    return candidate;
  }

  function createNode(parentNode, options) {
    const id = allocateId(parentNode, options.idBase);
    const node = {
      id,
      ref: `${parentNode.ref}.${id}`,
      label: options.label,
      description: options.description ?? null,
      children: [],
      childIds: new Set(),
      directoryPaths: options.directoryPath
        ? [normalizeAbsolutePath(options.directoryPath)]
        : [],
      filePaths: options.filePath ? [normalizeAbsolutePath(options.filePath)] : [],
      kind: "component",
      depth: parentNode.depth + 1,
    };

    parentNode.children.push(node);
    allNodes.push(node);
    return node;
  }

  return {
    createNode,
    allNodes,
  };
}

function materializeWorkspace(workspace, systemNode, nodeFactory) {
  const workspaceNode = nodeFactory.createNode(systemNode, {
    idBase: workspace.relativePath || "repository_configuration",
    label: workspace.label,
    description: workspace.description,
    directoryPath: workspace.relativePath
      ? path.join(repoRoot, workspace.relativePath)
      : repoRoot,
  });

  if (workspace.kind === "configuration") {
    for (const file of workspace.files.sort((first, second) =>
      compareByName(first.relPath, second.relPath),
    )) {
      if (!isMaterializableFile(file, workspace.kind, false)) {
        continue;
      }

      nodeFactory.createNode(workspaceNode, {
        idBase: `${file.stem}_file`,
        label: buildFileLabel(file, workspaceNode.label),
        filePath: file.absPath,
      });
    }

    return workspaceNode;
  }

  function materializeDirectoryChildren(directoryNode, parentNode, workspaceKind) {
    const childDirectories = Array.from(directoryNode.children.values())
      .filter((childDirectory) => childDirectory.totalFiles > 0)
      .sort((first, second) => compareByName(first.name, second.name));

    for (const childDirectory of childDirectories) {
      const childNode = nodeFactory.createNode(parentNode, {
        idBase: childDirectory.name,
        label: buildDirectoryLabel(childDirectory.name, workspaceKind),
        description: buildDirectoryDescription(childDirectory),
        directoryPath: childDirectory.absPath,
      });

      materializeDirectoryChildren(childDirectory, childNode, workspaceKind);
    }

    const materializableFiles = directoryNode.files
      .filter((file) =>
        isMaterializableFile(file, workspaceKind, childDirectories.length > 0),
      )
      .sort((first, second) => compareByName(first.relPath, second.relPath));

    const selectedFiles = childDirectories.length > 0
      ? materializableFiles.slice(0, MAX_FILE_NODES_PER_DIRECTORY)
      : materializableFiles.slice(0, MAX_FILE_NODES_PER_DIRECTORY);

    if (
      !childDirectories.length &&
      materializableFiles.length > MAX_FILE_NODES_PER_DIRECTORY &&
      workspaceKind !== "workflow" &&
      workspaceKind !== "configuration"
    ) {
      return;
    }

    for (const file of selectedFiles) {
      nodeFactory.createNode(parentNode, {
        idBase: `${file.stem}_file`,
        label: buildFileLabel(file, directoryNode.name || parentNode.label),
        filePath: file.absPath,
      });
    }
  }

  materializeDirectoryChildren(workspace.tree, workspaceNode, workspace.kind);
  return workspaceNode;
}

function nodeMatchesFile(node, filePath) {
  const normalizedPath = normalizeAbsolutePath(filePath);

  if (node.filePaths.includes(normalizedPath)) {
    return true;
  }

  return node.directoryPaths.some((directoryPath) => {
    return normalizedPath === directoryPath ||
      normalizedPath.startsWith(`${directoryPath}${path.sep}`);
  });
}

function resolveOwningNode(node, filePath) {
  if (!nodeMatchesFile(node, filePath)) {
    return null;
  }

  for (const childNode of node.children) {
    const matchedChild = resolveOwningNode(childNode, filePath);
    if (matchedChild) {
      return matchedChild;
    }
  }

  return node;
}

function parseTsconfigAliasRules() {
  const source = readFileSafe("tsconfig.json");

  if (!source) {
    return [];
  }

  try {
    const parsed = JSON.parse(source);
    const pathsConfig = parsed.compilerOptions?.paths ?? {};
    const rules = [];

    for (const [aliasPattern, targetPatterns] of Object.entries(pathsConfig)) {
      if (!Array.isArray(targetPatterns) || !targetPatterns.length) {
        continue;
      }

      const aliasHasWildcard = aliasPattern.includes("*");
      const aliasPrefix = aliasPattern.replace(/\*.*$/, "");
      const targetPattern = String(targetPatterns[0]);
      const targetHasWildcard = targetPattern.includes("*");
      const targetPrefix = targetPattern.replace(/\*.*$/, "");

      rules.push({
        aliasHasWildcard,
        aliasPrefix,
        targetHasWildcard,
        targetPrefix,
      });
    }

    return rules;
  } catch {
    return [];
  }
}

function resolveAliasImport(specifier, aliasRules) {
  for (const rule of aliasRules) {
    if (!specifier.startsWith(rule.aliasPrefix)) {
      continue;
    }

    const suffix = specifier.slice(rule.aliasPrefix.length);
    if (!rule.aliasHasWildcard && suffix.length > 0) {
      continue;
    }

    const targetRelativePath = rule.targetHasWildcard
      ? `${rule.targetPrefix}${suffix}`
      : rule.targetPrefix;

    return normalizeAbsolutePath(path.resolve(repoRoot, targetRelativePath));
  }

  return null;
}

function resolveFileCandidate(basePath) {
  const normalizedBasePath = normalizeAbsolutePath(basePath);
  const extensions = [
    "",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".html",
    ".css",
    ".md",
    ".c4",
    ".likec4",
  ];

  for (const extension of extensions) {
    const candidate = extension ? `${normalizedBasePath}${extension}` : normalizedBasePath;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizeAbsolutePath(candidate);
    }
  }

  for (const extension of extensions.filter(Boolean)) {
    const candidate = path.join(normalizedBasePath, `index${extension}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizeAbsolutePath(candidate);
    }
  }

  return null;
}

function normalizePackageSpecifier(specifier) {
  const cleanSpecifier = specifier.replace(/[?#].*$/, "");
  if (!cleanSpecifier || cleanSpecifier.startsWith(".") || cleanSpecifier.startsWith("/")) {
    return null;
  }

  if (cleanSpecifier.startsWith("node:")) {
    return null;
  }

  if (cleanSpecifier.startsWith("@")) {
    return cleanSpecifier.split("/").slice(0, 2).join("/");
  }

  return cleanSpecifier.split("/")[0];
}

function extractImportSpecifiers(source) {
  const matches = [];
  const expression =
    /\b(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]|(?:^|[^\w])import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/gm;

  for (const match of source.matchAll(expression)) {
    const specifier = match[1] ?? match[2];
    if (specifier) {
      matches.push(specifier);
    }
  }

  return uniqueSorted(matches);
}

function extractUrlHosts(source) {
  const hosts = [];
  const expression = /https?:\/\/[^\s"'`<>]+/g;

  for (const match of source.matchAll(expression)) {
    try {
      const url = new URL(match[0].replace(/[),.;]+$/g, ""));
      hosts.push(url.hostname);
    } catch {
      continue;
    }
  }

  return uniqueSorted(hosts);
}

function shouldExtractUrls(file, workspaceKind) {
  if (workspaceKind === "documentation") {
    return false;
  }

  if (file.category === "workflow" || file.category === "code") {
    return true;
  }

  if (file.category !== "config") {
    return false;
  }

  return (
    file.fileName === "wxt.config.ts" ||
    file.fileName === "vite.config.mjs" ||
    file.fileName === "vite.config.ts"
  );
}

function createLocalPackageResolvers(workspaces) {
  const packageByName = new Map();

  for (const workspace of workspaces) {
    if (!workspace.packageMeta?.name) {
      continue;
    }

    packageByName.set(workspace.packageMeta.name, workspace);
  }

  function resolveWorkspaceEntry(workspace) {
    const packageMeta = workspace.packageMeta;
    if (!packageMeta) {
      return workspace.relativePath
        ? normalizeAbsolutePath(path.join(repoRoot, workspace.relativePath))
        : repoRoot;
    }

    const importEntry =
      packageMeta.exports?.["."]?.import ||
      packageMeta.exports?.["."]?.default ||
      packageMeta.module ||
      packageMeta.main;

    if (typeof importEntry === "string") {
      const resolved = resolveFileCandidate(
        path.join(repoRoot, workspace.relativePath, importEntry),
      );
      if (resolved) {
        return resolved;
      }
    }

    const conventionalEntry = resolveFileCandidate(
      path.join(repoRoot, workspace.relativePath, "src/index"),
    );
    if (conventionalEntry) {
      return conventionalEntry;
    }

    return normalizeAbsolutePath(path.join(repoRoot, workspace.relativePath));
  }

  function resolveImportToWorkspaceFile(packageSpecifier) {
    const packageName = normalizePackageSpecifier(packageSpecifier);
    if (!packageName) {
      return null;
    }

    const workspace = packageByName.get(packageName);
    if (!workspace) {
      return null;
    }

    if (packageSpecifier === packageName) {
      return resolveWorkspaceEntry(workspace);
    }

    const subPath = packageSpecifier.slice(packageName.length + 1);
    return resolveFileCandidate(
      path.join(repoRoot, workspace.relativePath, subPath),
    );
  }

  return {
    packageByName,
    resolveImportToWorkspaceFile,
  };
}

function resolveLocalImport(sourceFilePath, specifier, aliasRules, packageResolvers) {
  const cleanedSpecifier = specifier.replace(/[?#].*$/, "");

  if (cleanedSpecifier.startsWith(".")) {
    return resolveFileCandidate(
      path.resolve(path.dirname(sourceFilePath), cleanedSpecifier),
    );
  }

  const aliasMatch = resolveAliasImport(cleanedSpecifier, aliasRules);
  if (aliasMatch) {
    return resolveFileCandidate(aliasMatch);
  }

  return packageResolvers.resolveImportToWorkspaceFile(cleanedSpecifier);
}

function createExternalRegistry() {
  const dependencies = new Map();
  const services = new Map();
  const actors = new Map();

  function register(targetMap, rawId, label, idPrefix = "") {
    const normalizedId = sanitizeId(idPrefix ? `${idPrefix}_${rawId}` : rawId);
    if (!targetMap.has(normalizedId)) {
      targetMap.set(normalizedId, {
        id: normalizedId,
        label,
        kind: targetMap === actors ? "actor" : "external",
      });
    }

    return normalizedId;
  }

  return {
    dependencies,
    services,
    actors,
    registerDependency(packageName) {
      return register(dependencies, packageName, packageName, "dependency");
    },
    registerService(hostname) {
      return register(services, hostname, hostname, "service");
    },
    registerActor(id, label) {
      return register(actors, id, label, "");
    },
  };
}

function createEdgeRegistry() {
  const edges = new Map();

  function isParentChildRelationship(source, target) {
    return source.startsWith(`${target}.`) || target.startsWith(`${source}.`);
  }

  function addEdge(source, target, kind, metadata = {}) {
    if (!source || !target || source === target) {
      return;
    }

    if (isParentChildRelationship(source, target)) {
      return;
    }

    const key = `${source}|${target}|${kind}`;
    if (!edges.has(key)) {
      edges.set(key, {
        source,
        target,
        kind,
        count: 0,
        scriptNames: new Set(),
      });
    }

    const edge = edges.get(key);
    edge.count += 1;

    if (metadata.scriptName) {
      edge.scriptNames.add(metadata.scriptName);
    }
  }

  return {
    addEdge,
    values() {
      return Array.from(edges.values());
    },
  };
}

function buildScriptTargetMap(rootPackageMeta, aliasRules, packageResolvers) {
  const scripts = rootPackageMeta?.scripts ?? {};
  const cache = new Map();

  function resolvePathToken(token) {
    const cleanedToken = token.replace(/^['"]|['"]$/g, "");
    if (!cleanedToken) {
      return null;
    }

    return resolveFileCandidate(path.resolve(repoRoot, cleanedToken));
  }

  function resolveScriptTargets(scriptName, stack = new Set()) {
    if (cache.has(scriptName)) {
      return cache.get(scriptName);
    }

    if (stack.has(scriptName)) {
      return [];
    }

    stack.add(scriptName);
    const command = scripts[scriptName];

    if (typeof command !== "string") {
      cache.set(scriptName, []);
      stack.delete(scriptName);
      return [];
    }

    const targets = [];

    for (const match of command.matchAll(/\bnode\s+([^\s&|;]+)/g)) {
      const resolved = resolvePathToken(match[1]);
      if (resolved) {
        targets.push(resolved);
      }
    }

    for (const match of command.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g)) {
      targets.push(...resolveScriptTargets(match[1], stack));
    }

    for (const match of command.matchAll(/\b(?:vite|wxt)\b[^\n]*?--config\s+([^\s&|;]+)/g)) {
      const resolved = resolvePathToken(match[1]);
      if (resolved) {
        targets.push(resolved);
      }
    }

    for (const match of command.matchAll(/\btsc\b[^\n]*?(?:-p|--project)\s+([^\s&|;]+)/g)) {
      const resolved = resolvePathToken(match[1]);
      if (resolved) {
        targets.push(resolved);
      }
    }

    for (const match of command.matchAll(/\bjest\b[^\n]*?--config\s+([^\s&|;]+)/g)) {
      const resolved = resolvePathToken(match[1]);
      if (resolved) {
        targets.push(resolved);
      }
    }

    const uniqueTargets = uniqueSorted(targets);
    cache.set(scriptName, uniqueTargets);
    stack.delete(scriptName);
    return uniqueTargets;
  }

  for (const scriptName of Object.keys(scripts)) {
    resolveScriptTargets(scriptName);
  }

  return cache;
}

function buildEdgeLabel(edge) {
  if (edge.kind === "internal") {
    return edge.count === 1
      ? "depends on"
      : `depends on (${pluralize(edge.count, "import")})`;
  }

  if (edge.kind === "dependency") {
    return edge.count === 1
      ? "uses"
      : `uses (${pluralize(edge.count, "import")})`;
  }

  if (edge.kind === "service") {
    return "references";
  }

  if (edge.kind === "workflow_script") {
    const scriptNames = Array.from(edge.scriptNames).sort(compareByName);
    return scriptNames.length
      ? `runs ${scriptNames.join(", ")}`
      : "runs repository command";
  }

  if (edge.kind === "actor") {
    return "uses";
  }

  return "depends on";
}

function generateViews(systemNode) {
  const viewTargets = [];

  for (const workspaceNode of systemNode.children) {
    viewTargets.push({
      id: `${workspaceNode.id}_overview`,
      ref: workspaceNode.ref,
      title: `${workspaceNode.label} Overview`,
    });

    for (const childNode of workspaceNode.children) {
      if (
        childNode.children.length >= 2 &&
        viewTargets.length < MAX_GENERATED_DETAIL_VIEWS + systemNode.children.length
      ) {
        viewTargets.push({
          id: `${workspaceNode.id}_${childNode.id}_overview`,
          ref: childNode.ref,
          title: `${workspaceNode.label}: ${childNode.label}`,
        });
      }
    }
  }

  const lines = [];
  writeLine(
    lines,
    0,
    "// Generated by scripts/generate-likec4-model.mjs. Do not edit directly.",
  );
  writeLine(lines, 0);
  writeLine(lines, 0, "views {");
  writeLine(lines, 1, "view index {");
  writeLine(lines, 2, "title 'Repository Landscape'");
  writeLine(lines, 2, "include *");
  writeLine(lines, 1, "}");
  writeLine(lines, 1);
  writeLine(lines, 1, "view repo_overview of fx_inline_repository {");
  writeLine(lines, 2, "title 'Repository Overview'");
  writeLine(lines, 2, "include *");
  writeLine(lines, 1, "}");

  for (const viewTarget of viewTargets) {
    writeLine(lines, 1);
    writeLine(lines, 1, `view ${sanitizeId(viewTarget.id)} of ${viewTarget.ref} {`);
    writeLine(lines, 2, `title ${q(viewTarget.title)}`);
    writeLine(lines, 2, "include *");
    writeLine(lines, 1, "}");
  }

  writeLine(lines, 0, "}");
  return `${lines.join("\n")}\n`;
}

const rootPackageMeta = readWorkspacePackageMeta("");
const repositoryName = rootPackageMeta?.name || "Repository";
const repositoryVersion = rootPackageMeta?.version || "0.0.0";
const repositoryDescription = rootPackageMeta?.description ||
  "Repository-wide architecture model inferred from source.";
const workspaces = discoverWorkspaces();
const aliasRules = parseTsconfigAliasRules();
const packageResolvers = createLocalPackageResolvers(workspaces);
const externalRegistry = createExternalRegistry();
const edgeRegistry = createEdgeRegistry();
const nodeFactory = createInternalNodeFactory();

const systemNode = {
  id: "fx_inline_repository",
  ref: "fx_inline_repository",
  label: repositoryName,
  description: `${repositoryDescription} Version ${repositoryVersion}. Auto-generated from recursive workspace discovery, import relationships, workflow commands, and external URL references.`,
  children: [],
  childIds: new Set(),
  directoryPaths: [repoRoot],
  filePaths: [],
  kind: "system",
  depth: 0,
};

const workspaceNodes = workspaces.map((workspace) =>
  materializeWorkspace(workspace, systemNode, nodeFactory)
);

function resolveInternalNode(filePath) {
  let bestMatch = null;

  for (const workspaceNode of workspaceNodes) {
    const match = resolveOwningNode(workspaceNode, filePath);
    if (!match) {
      continue;
    }

    if (
      !bestMatch ||
      match.depth > bestMatch.depth ||
      match.ref.length > bestMatch.ref.length
    ) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

for (const workspace of workspaces) {
  for (const file of workspace.files) {
    if (
      file.category !== "code" &&
      file.category !== "config" &&
      file.category !== "workflow"
    ) {
      continue;
    }

    const sourceNode = resolveInternalNode(file.absPath);
    if (!sourceNode) {
      continue;
    }

    const source = readAbsoluteFileSafe(file.absPath);
    if (!source) {
      continue;
    }

    for (const specifier of extractImportSpecifiers(source)) {
      const localTarget = resolveLocalImport(
        file.absPath,
        specifier,
        aliasRules,
        packageResolvers,
      );

      if (localTarget) {
        const targetNode = resolveInternalNode(localTarget);
        if (targetNode) {
          edgeRegistry.addEdge(sourceNode.ref, targetNode.ref, "internal");
          continue;
        }
      }

      const packageName = normalizePackageSpecifier(specifier);
      if (!packageName || BUILTIN_MODULES.has(packageName)) {
        continue;
      }

      const dependencyId = externalRegistry.registerDependency(packageName);
      edgeRegistry.addEdge(sourceNode.ref, dependencyId, "dependency");
    }

    if (shouldExtractUrls(file, workspace.kind)) {
      for (const hostname of extractUrlHosts(source)) {
        const serviceId = externalRegistry.registerService(hostname);
        edgeRegistry.addEdge(sourceNode.ref, serviceId, "service");
      }
    }
  }
}

const scriptTargetMap = buildScriptTargetMap(
  rootPackageMeta,
  aliasRules,
  packageResolvers,
);

for (const workflowWorkspace of workspaces.filter(
  (workspace) => workspace.kind === "workflow",
)) {
  for (const workflowFile of workflowWorkspace.files.filter(
    (file) => file.category === "workflow",
  )) {
    const sourceNode = resolveInternalNode(workflowFile.absPath);
    if (!sourceNode) {
      continue;
    }

    const workflowSource = readAbsoluteFileSafe(workflowFile.absPath);
    for (const match of workflowSource.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g)) {
      const scriptName = match[1];
      const targetPaths = scriptTargetMap.get(scriptName) ?? [];

      for (const targetPath of targetPaths) {
        const targetNode = resolveInternalNode(targetPath);
        if (targetNode) {
          edgeRegistry.addEdge(
            sourceNode.ref,
            targetNode.ref,
            "workflow_script",
            { scriptName },
          );
        }
      }
    }
  }
}

const maintainerId = externalRegistry.registerActor("maintainer", "Maintainer");
const applicationWorkspaces = workspaces.filter(
  (workspace) => workspace.kind === "application",
);

if (applicationWorkspaces.length) {
  const endUserId = externalRegistry.registerActor("end_user", "End User");

  for (const workspace of applicationWorkspaces) {
    const workspaceNode = workspaceNodes.find(
      (node) =>
        node.directoryPaths[0] === normalizeAbsolutePath(path.join(repoRoot, workspace.relativePath)),
    );
    if (workspaceNode) {
      edgeRegistry.addEdge(endUserId, workspaceNode.ref, "actor");
    }
  }
}

const configurationWorkspace = workspaces.find(
  (workspace) => workspace.kind === "configuration",
);
if (configurationWorkspace) {
  const configurationNode = workspaceNodes.find(
    (node) => node.label === "Repository Configuration",
  );
  if (configurationNode) {
    edgeRegistry.addEdge(maintainerId, configurationNode.ref, "actor");
  }
} else {
  edgeRegistry.addEdge(maintainerId, systemNode.ref, "actor");
}

const lines = [];
writeLine(
  lines,
  0,
  "// Generated by scripts/generate-likec4-model.mjs. Do not edit directly.",
);
writeLine(
  lines,
  0,
  `// Inferred ${pluralize(workspaces.length, "workspace")}, ${pluralize(nodeFactory.allNodes.length, "component")}, and ${pluralize(edgeRegistry.values().length, "relationship")}.`,
);
writeLine(lines, 0);
writeLine(lines, 0, "model {");

for (const actor of Array.from(externalRegistry.actors.values()).sort((first, second) =>
  compareByName(first.label, second.label),
)) {
  writeLine(lines, 1, `${actor.id} = actor ${q(actor.label)}`);
}

if (externalRegistry.actors.size) {
  writeLine(lines, 1);
}

for (const service of Array.from(externalRegistry.services.values()).sort((first, second) =>
  compareByName(first.label, second.label),
)) {
  writeLine(lines, 1, `${service.id} = external ${q(service.label)}`);
}

if (externalRegistry.services.size) {
  writeLine(lines, 1);
}

for (const dependency of Array.from(externalRegistry.dependencies.values()).sort((first, second) =>
  compareByName(first.label, second.label),
)) {
  writeLine(lines, 1, `${dependency.id} = external ${q(dependency.label)}`);
}

if (externalRegistry.dependencies.size) {
  writeLine(lines, 1);
}

function renderNode(node, indentationLevel) {
  const hasBody = Boolean(node.description) || node.children.length > 0;
  const nodeHeader = `${node.id} = component ${q(node.label)}`;

  if (!hasBody) {
    writeLine(lines, indentationLevel, nodeHeader);
    return;
  }

  writeLine(lines, indentationLevel, `${nodeHeader} {`);

  if (node.description) {
    writeLine(lines, indentationLevel + 1, `description ${q(node.description)}`);
  }

  for (const childNode of node.children.sort((first, second) =>
    compareByName(first.label, second.label),
  )) {
    renderNode(childNode, indentationLevel + 1);
  }

  writeLine(lines, indentationLevel, "}");
}

writeLine(lines, 1, `${systemNode.id} = system ${q(systemNode.label)} {`);
writeLine(lines, 2, `description ${q(systemNode.description)}`);

for (const workspaceNode of systemNode.children.sort((first, second) =>
  compareByName(first.label, second.label),
)) {
  renderNode(workspaceNode, 2);
}

writeLine(lines, 1, "}");
writeLine(lines, 1);

for (const edge of edgeRegistry.values().sort((first, second) => {
  const firstKey = `${first.source}|${first.target}|${first.kind}`;
  const secondKey = `${second.source}|${second.target}|${second.kind}`;
  return compareByName(firstKey, secondKey);
})) {
  writeLine(
    lines,
    1,
    `${edge.source} -> ${edge.target} ${q(buildEdgeLabel(edge))}`,
  );
}

writeLine(lines, 0, "}");

ensureParentDirectory(modelOutputPath);
ensureParentDirectory(viewsOutputPath);
fs.writeFileSync(modelOutputPath, `${lines.join("\n")}\n`, "utf8");
fs.writeFileSync(viewsOutputPath, generateViews(systemNode), "utf8");

process.stdout.write(
  `Generated ${path.relative(repoRoot, modelOutputPath)} and ${path.relative(repoRoot, viewsOutputPath)}\n`,
);
