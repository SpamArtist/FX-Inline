import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  FINAL_BUILD_NUMBER,
  MAX_MANIFEST_COMPONENT,
  MAX_RC_BUILD_NUMBER,
  compareManifestVersions,
  getArtifactNames,
  getLatestPreviousRelease,
  getLatestReleaseTag,
  listReleaseTags,
  parseReleaseTag,
  resolveReleaseTag,
  sortResolvedReleases,
} from "../../scripts/release/versioning.mjs";

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function createTaggedRepo(validTags, invalidTags = []) {
  const repoDir = mkdtempSync(join(tmpdir(), "fx-inline-versioning-"));

  git(repoDir, ["init"]);
  git(repoDir, ["config", "user.name", "FX Inline Tests"]);
  git(repoDir, ["config", "user.email", "tests@example.com"]);

  writeFileSync(join(repoDir, "release.txt"), "init\n");
  git(repoDir, ["add", "release.txt"]);
  git(repoDir, ["commit", "-m", "init"]);

  validTags.forEach((tag, index) => {
    writeFileSync(join(repoDir, "release.txt"), `${index}:${tag}\n`);
    git(repoDir, ["add", "release.txt"]);
    git(repoDir, ["commit", "-m", `tag ${tag}`]);
    git(repoDir, ["tag", "-a", tag, "-m", tag]);
  });

  invalidTags.forEach((tag) => {
    git(repoDir, ["tag", "-a", tag, "-m", tag]);
  });

  return repoDir;
}

test("parseReleaseTag and resolveReleaseTag support final release tags", () => {
  const parsed = parseReleaseTag("v12.34.56");
  const resolved = resolveReleaseTag("v12.34.56");

  assert.deepEqual(parsed, {
    releaseTag: "v12.34.56",
    major: 12,
    minor: 34,
    patch: 56,
    rcNumber: null,
    isRc: false,
  });
  assert.equal(resolved.channel, "final");
  assert.equal(resolved.displayVersion, "12.34.56");
  assert.equal(resolved.manifestBuild, FINAL_BUILD_NUMBER);
  assert.equal(resolved.manifestVersion, `12.34.56.${FINAL_BUILD_NUMBER}`);
  assert.deepEqual(resolved.manifestVersionParts, [12, 34, 56, FINAL_BUILD_NUMBER]);
  assert.equal(resolved.artifactBaseName, "fx-inline-12.34.56");
});

test("parseReleaseTag and resolveReleaseTag support rc release tags", () => {
  const parsed = parseReleaseTag(`v1.2.3-rc.${MAX_RC_BUILD_NUMBER}`);
  const resolved = resolveReleaseTag(`v1.2.3-rc.${MAX_RC_BUILD_NUMBER}`);

  assert.deepEqual(parsed, {
    releaseTag: `v1.2.3-rc.${MAX_RC_BUILD_NUMBER}`,
    major: 1,
    minor: 2,
    patch: 3,
    rcNumber: MAX_RC_BUILD_NUMBER,
    isRc: true,
  });
  assert.equal(resolved.channel, "rc");
  assert.equal(resolved.displayVersion, `1.2.3-rc.${MAX_RC_BUILD_NUMBER}`);
  assert.equal(resolved.manifestBuild, MAX_RC_BUILD_NUMBER);
  assert.equal(resolved.manifestVersion, `1.2.3.${MAX_RC_BUILD_NUMBER}`);
  assert.deepEqual(resolved.manifestVersionParts, [1, 2, 3, MAX_RC_BUILD_NUMBER]);
  assert.equal(resolved.artifactBaseName, `fx-inline-1.2.3-rc.${MAX_RC_BUILD_NUMBER}`);
});

test("parseReleaseTag rejects invalid tag formats", () => {
  const invalidTags = [
    "1.2.3",
    "v1.2",
    "v1.2.3.4",
    "v01.2.3",
    "v1.02.3",
    "v1.2.03",
    "v1.2.3-rc",
    "v1.2.3-rc.0",
    "v1.2.3-beta.1",
  ];

  invalidTags.forEach((releaseTag) => {
    assert.throws(
      () => parseReleaseTag(releaseTag),
      /Invalid release tag/,
      `${releaseTag} should be rejected`,
    );
  });

  assert.throws(() => parseReleaseTag(""), /RELEASE_TAG is required/);
});

test("parseReleaseTag enforces rc bounds", () => {
  assert.equal(parseReleaseTag(`v9.9.9-rc.${MAX_RC_BUILD_NUMBER}`).rcNumber, MAX_RC_BUILD_NUMBER);
  assert.throws(
    () => parseReleaseTag(`v9.9.9-rc.${MAX_RC_BUILD_NUMBER + 1}`),
    new RegExp(`must be between 1 and ${MAX_RC_BUILD_NUMBER}`),
  );
});

test("parseReleaseTag enforces manifest-safe component bounds", () => {
  const upperBound = parseReleaseTag(
    `v${MAX_MANIFEST_COMPONENT}.${MAX_MANIFEST_COMPONENT}.${MAX_MANIFEST_COMPONENT}`,
  );

  assert.deepEqual(
    [upperBound.major, upperBound.minor, upperBound.patch],
    [MAX_MANIFEST_COMPONENT, MAX_MANIFEST_COMPONENT, MAX_MANIFEST_COMPONENT],
  );
  assert.throws(
    () => parseReleaseTag(`v${MAX_MANIFEST_COMPONENT + 1}.0.0`),
    /major component "65536" exceeds the browser-safe manifest range/,
  );
  assert.throws(
    () => parseReleaseTag(`v0.${MAX_MANIFEST_COMPONENT + 1}.0`),
    /minor component "65536" exceeds the browser-safe manifest range/,
  );
  assert.throws(
    () => parseReleaseTag(`v0.0.${MAX_MANIFEST_COMPONENT + 1}`),
    /patch component "65536" exceeds the browser-safe manifest range/,
  );
});

test("compareManifestVersions and sortResolvedReleases order rc and final releases correctly", () => {
  const sorted = sortResolvedReleases([
    resolveReleaseTag("v2.0.0-rc.1"),
    resolveReleaseTag("v1.2.0"),
    resolveReleaseTag("v1.1.9"),
    resolveReleaseTag("v1.2.0-rc.10"),
    resolveReleaseTag("v1.2.0-rc.2"),
  ]).map((release) => release.releaseTag);

  assert.deepEqual(sorted, [
    "v1.1.9",
    "v1.2.0-rc.2",
    "v1.2.0-rc.10",
    "v1.2.0",
    "v2.0.0-rc.1",
  ]);
  assert.ok(compareManifestVersions("v1.2.0", "v1.2.0-rc.10") > 0);
  assert.ok(compareManifestVersions(resolveReleaseTag("v1.2.0-rc.2"), "v1.2.0-rc.10") < 0);
  assert.equal(compareManifestVersions("v1.2.0", resolveReleaseTag("v1.2.0")), 0);
});

test("getArtifactNames builds the expected release artifact names", () => {
  const artifacts = getArtifactNames("v2.3.4-rc.7");

  assert.deepEqual(artifacts, {
    chromeZip: "fx-inline-2.3.4-rc.7-chrome.zip",
    sourcesZip: "fx-inline-2.3.4-rc.7-sources.zip",
    chromeUnpackedArchive: "fx-inline-2.3.4-rc.7-chrome-unpacked.zip",
    firefoxSignedXpi: "fx-inline-2.3.4-rc.7-firefox.xpi",
    firefoxUploadArchive: "fx-inline-2.3.4-rc.7-firefox-upload.zip",
  });
});

test("listReleaseTags filters out malformed git tags", () => {
  const repoDir = createTaggedRepo(
    ["v1.0.0", "v1.1.0-rc.1"],
    ["release-1.1.0", "v1.1"],
  );

  try {
    assert.deepEqual(
      [...listReleaseTags(repoDir)].sort(),
      ["v1.0.0", "v1.1.0-rc.1"].sort(),
    );
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("git-backed release helpers resolve the latest release and previous semantic release", () => {
  const repoDir = createTaggedRepo(
    ["v1.0.0", "v1.1.0-rc.1", "v1.1.0-rc.2", "v1.1.0"],
    ["release-1.1.0"],
  );

  try {
    assert.equal(getLatestReleaseTag(repoDir), "v1.1.0");

    const previous = getLatestPreviousRelease("v1.1.0", repoDir);

    assert.ok(previous);
    assert.equal(previous.releaseTag, "v1.1.0-rc.2");
    assert.equal(previous.channel, "rc");
    assert.equal(previous.manifestVersion, "1.1.0.2");
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("git-backed release helpers return null when no valid release tags exist", () => {
  const repoDir = createTaggedRepo([], ["release-1.0.0", "v1.0"]);

  try {
    assert.deepEqual(listReleaseTags(repoDir), []);
    assert.equal(getLatestReleaseTag(repoDir), null);
    assert.equal(getLatestPreviousRelease("v1.0.0", repoDir), null);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});
