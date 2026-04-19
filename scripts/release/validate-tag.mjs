import {
  compareManifestVersions,
  getLatestPreviousRelease,
  resolveReleaseTagFromEnvironment,
} from "./versioning.mjs";

const release = resolveReleaseTagFromEnvironment();
const previousRelease = getLatestPreviousRelease(release.releaseTag);

if (previousRelease != null && compareManifestVersions(release, previousRelease) <= 0) {
  throw new Error(
    `Release tag ${release.releaseTag} resolves to ${release.manifestVersion}, which is not newer than ${previousRelease.releaseTag} (${previousRelease.manifestVersion}).`,
  );
}

process.stdout.write(
  previousRelease == null
    ? `Validated ${release.releaseTag}; no previous release tag found.\n`
    : `Validated ${release.releaseTag}; previous release is ${previousRelease.releaseTag}.\n`,
);
