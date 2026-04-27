import {
  readInlineRuntimeSettingsManifestFromDb,
  resolveAdminDbPath,
  writeGeneratedManifestFile,
} from "./settings-store.mjs";

const dbPath = resolveAdminDbPath();
const manifest = readInlineRuntimeSettingsManifestFromDb(dbPath);
const outputPath = writeGeneratedManifestFile(manifest);

process.stdout.write(`Exported inline runtime settings from ${dbPath} to ${outputPath}.\n`);
