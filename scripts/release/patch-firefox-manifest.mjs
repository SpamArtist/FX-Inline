import fs from "node:fs/promises";
import path from "node:path";
import { resolveReleaseTagFromEnvironment } from "./versioning.mjs";

const release = resolveReleaseTagFromEnvironment();
const manifestPath = process.argv[2] ?? path.join(".output", "firefox-mv2", "manifest.json");
const rawManifest = await fs.readFile(manifestPath, "utf8");
const manifest = JSON.parse(rawManifest);

manifest.version = release.manifestVersion;
manifest.version_name = release.displayVersion;

await fs.writeFile(manifestPath, JSON.stringify(manifest), "utf8");
process.stdout.write(`Patched Firefox manifest at ${manifestPath}.\n`);
