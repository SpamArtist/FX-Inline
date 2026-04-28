import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  createDefaultInlineRuntimeSettingsManifest,
  sanitizeInlineRuntimeSettingsManifest,
} from "@fx-inline/settings-schema";
import type {
  InlineRuntimeSettings,
  InlineRuntimeSettingsManifest,
} from "@fx-inline/settings-schema";

export {
  createDefaultInlineRuntimeSettings,
  createDefaultInlineRuntimeSettingsManifest,
  INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION,
  normalizeDomainScope,
  normalizePageScope,
  sanitizeInlineRuntimeSettings,
  sanitizeInlineRuntimeSettingsManifest,
} from "@fx-inline/settings-schema";

export type {
  InlineRuntimeSettings,
  InlineRuntimeSettingsManifest,
} from "@fx-inline/settings-schema";

interface SettingsScopeRow {
  scope_type: string;
  scope_key: string;
  settings_json: string;
}

interface MetaRow {
  value: string;
}

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDirectory, "../..");
const DEFAULT_ADMIN_DB_PATH = path.resolve(repoRoot, "apps/admin/data/settings.sqlite");

export function resolveAdminDbPath(inputPath = process.env.FX_INLINE_ADMIN_DB_PATH): string {
  return inputPath ? path.resolve(inputPath) : DEFAULT_ADMIN_DB_PATH;
}

function openDatabase(dbPath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS inline_runtime_settings_scopes (
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (scope_type, scope_key)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS inline_runtime_settings_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  return db;
}

function rowToSettings(row: SettingsScopeRow): InlineRuntimeSettings {
  return JSON.parse(row.settings_json) as InlineRuntimeSettings;
}

export function readInlineRuntimeSettingsManifestFromDb(
  dbPath = resolveAdminDbPath(),
): InlineRuntimeSettingsManifest {
  const db = openDatabase(dbPath);

  try {
    const rows = db
      .prepare("SELECT scope_type, scope_key, settings_json FROM inline_runtime_settings_scopes")
      .all() as unknown as SettingsScopeRow[];
    const generatedAtRow = db
      .prepare("SELECT value FROM inline_runtime_settings_meta WHERE key = ?")
      .get("generatedAt") as MetaRow | undefined;
    const manifest = createDefaultInlineRuntimeSettingsManifest();

    for (const row of rows) {
      if (row.scope_type === "all_urls" && row.scope_key === "all_urls") {
        manifest.scopes.allUrls = rowToSettings(row);
      } else if (row.scope_type === "domain") {
        manifest.scopes.domains[row.scope_key] = rowToSettings(row);
      } else if (row.scope_type === "page") {
        manifest.scopes.pages[row.scope_key] = rowToSettings(row);
      }
    }

    return sanitizeInlineRuntimeSettingsManifest({
      ...manifest,
      generatedAt:
        typeof generatedAtRow?.value === "string"
          ? generatedAtRow.value
          : manifest.generatedAt,
    });
  } finally {
    db.close();
  }
}

export function writeInlineRuntimeSettingsManifestToDb(
  manifestInput: unknown,
  dbPath = resolveAdminDbPath(),
): InlineRuntimeSettingsManifest {
  const manifest = sanitizeInlineRuntimeSettingsManifest(manifestInput);
  const db = openDatabase(dbPath);
  const now = new Date().toISOString();
  manifest.generatedAt = now;
  const upsert = db.prepare(`
    INSERT INTO inline_runtime_settings_scopes
      (scope_type, scope_key, settings_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(scope_type, scope_key) DO UPDATE SET
      settings_json = excluded.settings_json,
      updated_at = excluded.updated_at
  `);

  try {
    db.exec("BEGIN");
    db.prepare("DELETE FROM inline_runtime_settings_scopes").run();
    db.prepare(`
      INSERT INTO inline_runtime_settings_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run("generatedAt", now);
    upsert.run("all_urls", "all_urls", JSON.stringify(manifest.scopes.allUrls), now);

    for (const [domain, settings] of Object.entries(manifest.scopes.domains)) {
      upsert.run("domain", domain, JSON.stringify(settings), now);
    }

    for (const [pageUrl, settings] of Object.entries(manifest.scopes.pages)) {
      upsert.run("page", pageUrl, JSON.stringify(settings), now);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }

  return manifest;
}

export function writeGeneratedManifestFile(
  manifestInput: unknown,
  outputPath = path.resolve(
    repoRoot,
    "apps/extension/generated/inlineRuntimeSettingsManifest.ts",
  ),
): string {
  const manifest = sanitizeInlineRuntimeSettingsManifest(manifestInput);
  const content = [
    "export const GENERATED_INLINE_RUNTIME_SETTINGS_MANIFEST = ",
    `${JSON.stringify(manifest, null, 2)};`,
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");
  return outputPath;
}

export function saveAndExportInlineRuntimeSettingsManifest(
  manifestInput: unknown,
  {
    dbPath = resolveAdminDbPath(),
    outputPath,
  }: {
    dbPath?: string;
    outputPath?: string;
  } = {},
): {
  manifest: InlineRuntimeSettingsManifest;
  outputPath: string;
} {
  const manifest = writeInlineRuntimeSettingsManifestToDb(manifestInput, dbPath);
  const generatedManifestPath = writeGeneratedManifestFile(manifest, outputPath);

  return {
    manifest,
    outputPath: generatedManifestPath,
  };
}
