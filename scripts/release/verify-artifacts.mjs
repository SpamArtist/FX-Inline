import fs from "node:fs/promises";
import path from "node:path";
import {
  getArtifactNames,
  resolveReleaseTagFromEnvironment,
} from "./versioning.mjs";
import { assertManifestHygiene } from "./manifest-hygiene.mjs";

async function assertFileExists(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Expected artifact "${filePath}" was not found.`);
  }
}

async function assertFileDoesNotExist(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    return;
  }

  throw new Error(`Unexpected stale artifact "${filePath}" was found.`);
}

const release = resolveReleaseTagFromEnvironment();
const artifacts = getArtifactNames(release);

const chromeManifestPath = path.join(".output", "chrome-mv3", "manifest.json");
const firefoxManifestPath = path.join(".output", "firefox-mv2", "manifest.json");
const chromePopupPath = path.join(".output", "chrome-mv3", "popup.html");
const firefoxPopupPath = path.join(".output", "firefox-mv2", "popup.html");

const chromeManifest = JSON.parse(await fs.readFile(chromeManifestPath, "utf8"));
const firefoxManifest = JSON.parse(await fs.readFile(firefoxManifestPath, "utf8"));
const chromePopupHtml = await fs.readFile(chromePopupPath, "utf8");
const firefoxPopupHtml = await fs.readFile(firefoxPopupPath, "utf8");

if (chromeManifest.version !== release.manifestVersion) {
  throw new Error(
    `Chrome manifest version mismatch: expected ${release.manifestVersion}, found ${chromeManifest.version}.`,
  );
}

if (chromeManifest.version_name !== release.displayVersion) {
  throw new Error(
    `Chrome manifest display version mismatch: expected ${release.displayVersion}, found ${chromeManifest.version_name}.`,
  );
}

if (firefoxManifest.version !== release.manifestVersion) {
  throw new Error(
    `Firefox manifest version mismatch: expected ${release.manifestVersion}, found ${firefoxManifest.version}.`,
  );
}

if (firefoxManifest.version_name !== release.displayVersion) {
  throw new Error(
    `Firefox manifest display version mismatch: expected ${release.displayVersion}, found ${firefoxManifest.version_name}.`,
  );
}

assertManifestHygiene({
  chromeManifest,
  firefoxManifest,
  chromePopupHtml,
  firefoxPopupHtml,
});

await assertFileExists(path.join(".release", artifacts.chromeZip));
await assertFileExists(path.join(".release", artifacts.sourcesZip));
await assertFileDoesNotExist(path.join(".output", "chrome-mv3", "fx-inline-logo.svg"));
await assertFileDoesNotExist(path.join(".output", "chrome-mv3", "icon", "96.png"));
await assertFileDoesNotExist(path.join(".output", "firefox-mv2", "fx-inline-logo.svg"));
await assertFileDoesNotExist(path.join(".output", "firefox-mv2", "icon", "96.png"));

if (release.channel === "rc") {
  await assertFileExists(path.join(".release", artifacts.chromeUnpackedArchive));
  await assertFileExists(path.join(".release", artifacts.firefoxSignedXpi));
} else {
  await assertFileExists(path.join(".release", artifacts.firefoxUploadArchive));
}

const staleOutputFiles = (await fs.readdir(".output"))
  .filter((name) => name.startsWith("fx-inline-"))
  .filter((name) => ![artifacts.chromeZip, artifacts.sourcesZip].includes(name));

if (staleOutputFiles.length > 0) {
  throw new Error(
    `Found stale versioned archives in .output: ${staleOutputFiles.join(", ")}.`,
  );
}

process.stdout.write(
  `Verified release artifacts for ${release.releaseTag} (${release.manifestVersion}).\n`,
);
