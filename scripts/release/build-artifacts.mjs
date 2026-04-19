import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getArtifactNames,
  resolveReleaseTagFromEnvironment,
} from "./versioning.mjs";

const release = resolveReleaseTagFromEnvironment();
const artifacts = getArtifactNames(release);

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
  }
}

async function copyArtifactFromOutput(filename) {
  const sourcePath = path.join(".output", filename);
  const destinationPath = path.join(".release", filename);
  await fs.copyFile(sourcePath, destinationPath);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for ${release.channel} artifact generation.`);
  }
  return value;
}

await fs.rm(".output", { recursive: true, force: true });
await fs.rm(".release", { recursive: true, force: true });
await fs.mkdir(".release", { recursive: true });

run(getNpmCommand(), ["run", "zip", "--", "--sources"]);
await copyArtifactFromOutput(artifacts.chromeZip);
await copyArtifactFromOutput(artifacts.sourcesZip);

run(getNpmCommand(), ["run", "build:firefox"]);
run("node", ["scripts/release/patch-firefox-manifest.mjs"]);

if (release.channel === "rc") {
  run("node", [
    "scripts/release/archive-directory.mjs",
    "--source",
    ".output/chrome-mv3",
    "--output",
    path.join(".release", artifacts.chromeUnpackedArchive),
  ]);

  const amoIssuer = requireEnv("AMO_JWT_ISSUER");
  const amoSecret = requireEnv("AMO_JWT_SECRET");
  const unsignedArtifactsDir = path.join(".release", "firefox-unlisted");
  await fs.rm(unsignedArtifactsDir, { recursive: true, force: true });
  await fs.mkdir(unsignedArtifactsDir, { recursive: true });

  run(getNpmCommand(), [
    "exec",
    "--",
    "web-ext",
    "sign",
    "--channel",
    "unlisted",
    "--source-dir",
    ".output/firefox-mv2",
    "--artifacts-dir",
    unsignedArtifactsDir,
    "--api-key",
    amoIssuer,
    "--api-secret",
    amoSecret,
  ]);

  const xpiFiles = (await fs.readdir(unsignedArtifactsDir)).filter((file) =>
    file.endsWith(".xpi"),
  );

  if (xpiFiles.length !== 1) {
    throw new Error(
      `Expected exactly one Firefox XPI in ${unsignedArtifactsDir}, found ${xpiFiles.length}.`,
    );
  }

  await fs.copyFile(
    path.join(unsignedArtifactsDir, xpiFiles[0]),
    path.join(".release", artifacts.firefoxSignedXpi),
  );
} else {
  run("node", [
    "scripts/release/archive-directory.mjs",
    "--source",
    ".output/firefox-mv2",
    "--output",
    path.join(".release", artifacts.firefoxUploadArchive),
  ]);
}

run("node", ["scripts/release/describe.mjs", "--write-release-file"]);
run("node", ["scripts/release/verify-artifacts.mjs"]);
