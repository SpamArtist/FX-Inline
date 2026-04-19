import { execFileSync } from "node:child_process";

const TAG_PATTERN =
  /^v(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-rc\.(?<rc>[1-9]\d*))?$/;

export const FINAL_BUILD_NUMBER = 50000;
export const MAX_RC_BUILD_NUMBER = 49999;
export const MAX_MANIFEST_COMPONENT = 65535;

function parseComponent(rawValue, label) {
  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid ${label} component "${rawValue}".`);
  }
  if (value < 0 || value > MAX_MANIFEST_COMPONENT) {
    throw new Error(
      `${label} component "${rawValue}" exceeds the browser-safe manifest range 0-${MAX_MANIFEST_COMPONENT}.`,
    );
  }
  return value;
}

export function parseReleaseTag(releaseTag) {
  if (!releaseTag) {
    throw new Error("RELEASE_TAG is required.");
  }

  const match = releaseTag.match(TAG_PATTERN);
  if (!match?.groups) {
    throw new Error(
      `Invalid release tag "${releaseTag}". Expected vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-rc.N.`,
    );
  }

  const major = parseComponent(match.groups.major, "major");
  const minor = parseComponent(match.groups.minor, "minor");
  const patch = parseComponent(match.groups.patch, "patch");
  const rcNumber =
    match.groups.rc == null
      ? null
      : parseComponent(match.groups.rc, "release candidate");

  if (rcNumber != null && (rcNumber < 1 || rcNumber > MAX_RC_BUILD_NUMBER)) {
    throw new Error(
      `Release candidate number "${rcNumber}" must be between 1 and ${MAX_RC_BUILD_NUMBER}.`,
    );
  }

  return {
    releaseTag,
    major,
    minor,
    patch,
    rcNumber,
    isRc: rcNumber != null,
  };
}

export function resolveReleaseTag(releaseTag) {
  const parsed = parseReleaseTag(releaseTag);
  const displayVersion = parsed.isRc
    ? `${parsed.major}.${parsed.minor}.${parsed.patch}-rc.${parsed.rcNumber}`
    : `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  const manifestBuild = parsed.isRc ? parsed.rcNumber : FINAL_BUILD_NUMBER;
  const manifestVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}.${manifestBuild}`;

  return {
    ...parsed,
    channel: parsed.isRc ? "rc" : "final",
    displayVersion,
    manifestBuild,
    manifestVersion,
    manifestVersionParts: [parsed.major, parsed.minor, parsed.patch, manifestBuild],
    artifactBaseName: `fx-inline-${displayVersion}`,
  };
}

export function getReleaseTagFromEnvironment(env = process.env) {
  const releaseTag = env.RELEASE_TAG?.trim();
  if (!releaseTag) {
    throw new Error("RELEASE_TAG is required.");
  }
  return releaseTag;
}

export function resolveReleaseTagFromEnvironment(env = process.env) {
  return resolveReleaseTag(getReleaseTagFromEnvironment(env));
}

export function compareManifestVersions(left, right) {
  const leftParts = left.manifestVersionParts ?? resolveReleaseTag(left.releaseTag ?? left).manifestVersionParts;
  const rightParts =
    right.manifestVersionParts ?? resolveReleaseTag(right.releaseTag ?? right).manifestVersionParts;

  for (let index = 0; index < 4; index += 1) {
    const delta = leftParts[index] - rightParts[index];
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

export function sortResolvedReleases(releases) {
  return [...releases].sort(compareManifestVersions);
}

function runGit(args, cwd = process.cwd()) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function listReleaseTags(cwd = process.cwd()) {
  try {
    return runGit(["tag", "--list", "v*"], cwd)
      .split("\n")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag) => TAG_PATTERN.test(tag));
  } catch {
    return [];
  }
}

export function getLatestReleaseTag(cwd = process.cwd()) {
  try {
    const tag = runGit(["describe", "--abbrev=0", "--match", "v[0-9]*"], cwd);
    return TAG_PATTERN.test(tag) ? tag : null;
  } catch {
    return null;
  }
}

export function getLatestPreviousRelease(currentTag, cwd = process.cwd()) {
  const previous = listReleaseTags(cwd)
    .filter((tag) => tag !== currentTag)
    .map(resolveReleaseTag);

  if (previous.length === 0) {
    return null;
  }

  return sortResolvedReleases(previous).at(-1) ?? null;
}

export function getArtifactNames(release) {
  const resolved =
    release.manifestVersion == null ? resolveReleaseTag(release.releaseTag ?? release) : release;

  return {
    chromeZip: `${resolved.artifactBaseName}-chrome.zip`,
    sourcesZip: `${resolved.artifactBaseName}-sources.zip`,
    chromeUnpackedArchive: `${resolved.artifactBaseName}-chrome-unpacked.zip`,
    firefoxSignedXpi: `${resolved.artifactBaseName}-firefox.xpi`,
    firefoxUploadArchive: `${resolved.artifactBaseName}-firefox-upload.zip`,
  };
}
