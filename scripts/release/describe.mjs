import fs from "node:fs";
import path from "node:path";
import {
  getArtifactNames,
  getLatestPreviousRelease,
  resolveReleaseTagFromEnvironment,
} from "./versioning.mjs";

const release = resolveReleaseTagFromEnvironment();
const artifacts = getArtifactNames(release);
const previousRelease = getLatestPreviousRelease(release.releaseTag);

const payload = {
  ...release,
  previousReleaseTag: previousRelease?.releaseTag ?? null,
  previousManifestVersion: previousRelease?.manifestVersion ?? null,
  artifacts,
};

if (process.argv.includes("--github-output")) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error("GITHUB_OUTPUT is required when using --github-output.");
  }

  const lines = [
    `release_tag=${payload.releaseTag}`,
    `channel=${payload.channel}`,
    `display_version=${payload.displayVersion}`,
    `manifest_version=${payload.manifestVersion}`,
    `is_rc=${String(payload.channel === "rc")}`,
    `is_final=${String(payload.channel === "final")}`,
    `artifact_base_name=${payload.artifactBaseName}`,
    `chrome_zip=${payload.artifacts.chromeZip}`,
    `sources_zip=${payload.artifacts.sourcesZip}`,
    `chrome_unpacked_archive=${payload.artifacts.chromeUnpackedArchive}`,
    `firefox_signed_xpi=${payload.artifacts.firefoxSignedXpi}`,
    `firefox_upload_archive=${payload.artifacts.firefoxUploadArchive}`,
  ];

  if (payload.previousReleaseTag) {
    lines.push(`previous_release_tag=${payload.previousReleaseTag}`);
    lines.push(`previous_manifest_version=${payload.previousManifestVersion}`);
  }

  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
}

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(0);
}

if (process.argv.includes("--write-release-file")) {
  await fs.promises.mkdir(".release", { recursive: true });
  await fs.promises.writeFile(
    path.join(".release", "release.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

process.stdout.write(
  [
    `Release tag: ${payload.releaseTag}`,
    `Channel: ${payload.channel}`,
    `Display version: ${payload.displayVersion}`,
    `Manifest version: ${payload.manifestVersion}`,
    `Previous release: ${payload.previousReleaseTag ?? "none"}`,
    `Chrome zip: ${payload.artifacts.chromeZip}`,
    `Sources zip: ${payload.artifacts.sourcesZip}`,
    payload.channel === "rc"
      ? `Firefox signed XPI: ${payload.artifacts.firefoxSignedXpi}`
      : `Firefox upload archive: ${payload.artifacts.firefoxUploadArchive}`,
  ].join("\n"),
);
process.stdout.write("\n");
