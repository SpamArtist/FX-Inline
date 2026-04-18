#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDirectory, "..");
const likec4Bin = path.join(repoRoot, "node_modules", "likec4", "bin", "likec4.mjs");

function ensureWritableDirectory(directoryPath) {
  try {
    fs.mkdirSync(directoryPath, { recursive: true });
    fs.accessSync(directoryPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function getConfigProbeDirectory(homeDirectory) {
  if (process.platform === "darwin") {
    return path.join(homeDirectory, "Library", "Preferences");
  }

  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(homeDirectory, "AppData", "Roaming");
  }

  return process.env.XDG_CONFIG_HOME || path.join(homeDirectory, ".config");
}

function getLikeC4HomeOverride() {
  const configuredHome = process.env.LIKEC4_HOME?.trim();
  if (configuredHome) {
    return configuredHome;
  }

  const currentHome = os.homedir();
  if (ensureWritableDirectory(getConfigProbeDirectory(currentHome))) {
    return null;
  }

  const fallbackHome = path.join(os.tmpdir(), "likec4-home");
  fs.mkdirSync(fallbackHome, { recursive: true });
  return fallbackHome;
}

if (!fs.existsSync(likec4Bin)) {
  process.stderr.write(
    "LikeC4 is not installed. Run `npm install` before invoking architecture scripts.\n",
  );
  process.exit(1);
}

const env = { ...process.env };
const likec4HomeOverride = getLikeC4HomeOverride();

if (likec4HomeOverride) {
  env.HOME = likec4HomeOverride;
  env.USERPROFILE = likec4HomeOverride;
  env.APPDATA = path.join(likec4HomeOverride, "AppData", "Roaming");
  env.LOCALAPPDATA = path.join(likec4HomeOverride, "AppData", "Local");
  env.XDG_CONFIG_HOME = path.join(likec4HomeOverride, ".config");
  env.XDG_CACHE_HOME = path.join(likec4HomeOverride, ".cache");
  env.XDG_STATE_HOME = path.join(likec4HomeOverride, ".local", "state");
}

const result = spawnSync(
  process.execPath,
  [likec4Bin, ...process.argv.slice(2)],
  {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  },
);

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  throw result.error;
}

process.exit(1);
