export interface ParsedReleaseTag {
  releaseTag: string;
  major: number;
  minor: number;
  patch: number;
  rcNumber: number | null;
  isRc: boolean;
}

export interface ResolvedReleaseTag extends ParsedReleaseTag {
  channel: "rc" | "final";
  displayVersion: string;
  manifestBuild: number;
  manifestVersion: string;
  manifestVersionParts: [number, number, number, number];
  artifactBaseName: string;
}

export interface ReleaseArtifacts {
  chromeZip: string;
  sourcesZip: string;
  chromeUnpackedArchive: string;
  firefoxSignedXpi: string;
  firefoxUploadArchive: string;
}

export type ReleaseValue =
  | string
  | {
      releaseTag?: string;
      manifestVersion?: string;
      manifestVersionParts?: [number, number, number, number];
    };

export const FINAL_BUILD_NUMBER: number;
export const MAX_RC_BUILD_NUMBER: number;
export const MAX_MANIFEST_COMPONENT: number;

export function parseReleaseTag(releaseTag: string): ParsedReleaseTag;
export function resolveReleaseTag(releaseTag: string): ResolvedReleaseTag;
export function getReleaseTagFromEnvironment(env?: NodeJS.ProcessEnv): string;
export function resolveReleaseTagFromEnvironment(
  env?: NodeJS.ProcessEnv,
): ResolvedReleaseTag;
export function compareManifestVersions(
  left: ReleaseValue,
  right: ReleaseValue,
): number;
export function sortResolvedReleases(
  releases: ResolvedReleaseTag[],
): ResolvedReleaseTag[];
export function listReleaseTags(cwd?: string): string[];
export function getLatestReleaseTag(cwd?: string): string | null;
export function getLatestPreviousRelease(
  currentTag: string,
  cwd?: string,
): ResolvedReleaseTag | null;
export function getArtifactNames(release: ReleaseValue): ReleaseArtifacts;
