import type { InlineRuntimeSettingsManifest } from "./settings-manifest.js";

export {
  createDefaultInlineRuntimeSettings,
  createDefaultInlineRuntimeSettingsManifest,
  getDisplayStylePreview,
  normalizeDomainScope,
  normalizePageScope,
  sanitizeInlineRuntimeSettings,
  sanitizeInlineRuntimeSettingsManifest,
} from "./settings-manifest.js";
export type {
  DisplayStyleOption,
  InlineRuntimeSettings,
  InlineRuntimeSettingsManifest,
} from "./settings-manifest.js";

export function resolveAdminDbPath(inputPath?: string): string;
export function readInlineRuntimeSettingsManifestFromDb(
  dbPath?: string,
): InlineRuntimeSettingsManifest;
export function writeInlineRuntimeSettingsManifestToDb(
  manifestInput: unknown,
  dbPath?: string,
): InlineRuntimeSettingsManifest;
export function writeGeneratedManifestFile(
  manifestInput: unknown,
  outputPath?: string,
): string;
