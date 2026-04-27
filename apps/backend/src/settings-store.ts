import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

export const INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION = 1;

export interface InlineRuntimeSettings {
  enabled: boolean;
  domain: string;
  pageUrl: string;
  targetCurrencies: string[];
  convertedCurrencyPosition: string;
  displayStyle: string;
  highlightColor: string;
  extraSettings: Record<string, unknown>;
}

export interface InlineRuntimeSettingsManifest {
  schemaVersion: number;
  generatedAt: string;
  scopes: {
    allUrls: InlineRuntimeSettings;
    domains: Record<string, InlineRuntimeSettings>;
    pages: Record<string, InlineRuntimeSettings>;
  };
}

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
const DEFAULT_GENERATED_AT = "1970-01-01T00:00:00.000Z";
const DEFAULT_TARGET_CURRENCY = "EUR";
const DEFAULT_POSITION = "right";
const DEFAULT_DISPLAY_STYLE = "brackets";
const DEFAULT_HIGHLIGHT_COLOR = "#fff1a8";
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;
const VALID_POSITIONS = new Set(["top", "bottom", "left", "right", "tooltip"]);
const VALID_DISPLAY_STYLES = new Set([
  "pill",
  "underline",
  "highlightColor",
  "brackets",
]);

const currencyList = JSON.parse(
  fs.readFileSync(path.resolve(repoRoot, "apps/extension/assets/currency.json"), "utf8"),
) as Array<{ code: string }>;
const VALID_CURRENCY_CODES = new Set(currencyList.map((entry) => entry.code));
VALID_CURRENCY_CODES.add(DEFAULT_TARGET_CURRENCY);

export function resolveAdminDbPath(inputPath = process.env.FX_INLINE_ADMIN_DB_PATH): string {
  return inputPath ? path.resolve(inputPath) : DEFAULT_ADMIN_DB_PATH;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asTargetCurrencies(value: unknown, fallback: string[]): string[] {
  const fallbackTarget = fallback[0] ?? DEFAULT_TARGET_CURRENCY;
  if (!Array.isArray(value)) return [fallbackTarget];

  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().toUpperCase();
    if (VALID_CURRENCY_CODES.has(normalized)) {
      return [normalized];
    }
  }

  return [fallbackTarget];
}

function asHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value.toLowerCase()
    : fallback;
}

export function normalizeDomainScope(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function normalizePageScope(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function createDefaultInlineRuntimeSettings(
  overrides: Partial<InlineRuntimeSettings> = {},
): InlineRuntimeSettings {
  return {
    enabled: overrides.enabled ?? true,
    domain: overrides.domain ?? "",
    pageUrl: overrides.pageUrl ?? "",
    targetCurrencies: asTargetCurrencies(
      overrides.targetCurrencies,
      [DEFAULT_TARGET_CURRENCY],
    ),
    convertedCurrencyPosition: overrides.convertedCurrencyPosition ?? DEFAULT_POSITION,
    displayStyle: overrides.displayStyle ?? DEFAULT_DISPLAY_STYLE,
    highlightColor: asHexColor(overrides.highlightColor, DEFAULT_HIGHLIGHT_COLOR),
    extraSettings: {
      ...(overrides.extraSettings ?? {}),
    },
  };
}

export function createDefaultInlineRuntimeSettingsManifest(): InlineRuntimeSettingsManifest {
  return {
    schemaVersion: INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION,
    generatedAt: DEFAULT_GENERATED_AT,
    scopes: {
      allUrls: createDefaultInlineRuntimeSettings(),
      domains: {},
      pages: {},
    },
  };
}

function collectExtraSettings(value: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(value.extraSettings)) return {};
  return JSON.parse(JSON.stringify(value.extraSettings)) as Record<string, unknown>;
}

export function sanitizeInlineRuntimeSettings(
  value: unknown,
  fallback = createDefaultInlineRuntimeSettings(),
): InlineRuntimeSettings {
  const raw = isRecord(value) ? value : {};
  const fallbackTargets = fallback.targetCurrencies.length
    ? fallback.targetCurrencies
    : [DEFAULT_TARGET_CURRENCY];

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    domain:
      typeof raw.domain === "string"
        ? normalizeDomainScope(raw.domain) ?? fallback.domain
        : fallback.domain,
    pageUrl:
      typeof raw.pageUrl === "string"
        ? normalizePageScope(raw.pageUrl) ?? fallback.pageUrl
        : fallback.pageUrl,
    targetCurrencies: asTargetCurrencies(raw.targetCurrencies, fallbackTargets),
    convertedCurrencyPosition:
      typeof raw.convertedCurrencyPosition === "string" &&
      VALID_POSITIONS.has(raw.convertedCurrencyPosition)
        ? raw.convertedCurrencyPosition
        : fallback.convertedCurrencyPosition,
    displayStyle:
      typeof raw.displayStyle === "string" && VALID_DISPLAY_STYLES.has(raw.displayStyle)
        ? raw.displayStyle
        : fallback.displayStyle,
    highlightColor: asHexColor(raw.highlightColor, fallback.highlightColor),
    extraSettings: collectExtraSettings(raw),
  };
}

export function sanitizeInlineRuntimeSettingsManifest(
  value: unknown,
): InlineRuntimeSettingsManifest {
  const fallback = createDefaultInlineRuntimeSettingsManifest();
  const raw = isRecord(value) ? value : {};
  const rawScopes = isRecord(raw.scopes) ? raw.scopes : {};
  const allUrls = sanitizeInlineRuntimeSettings(rawScopes.allUrls, fallback.scopes.allUrls);
  const domains: Record<string, InlineRuntimeSettings> = {};
  const pages: Record<string, InlineRuntimeSettings> = {};

  if (isRecord(rawScopes.domains)) {
    for (const [domainKey, domainValue] of Object.entries(rawScopes.domains)) {
      const domain = normalizeDomainScope(domainKey);
      if (!domain) continue;
      domains[domain] = sanitizeInlineRuntimeSettings(domainValue, {
        ...allUrls,
        domain,
        pageUrl: "",
      });
    }
  }

  if (isRecord(rawScopes.pages)) {
    for (const [pageKey, pageValue] of Object.entries(rawScopes.pages)) {
      const pageUrl = normalizePageScope(pageKey);
      if (!pageUrl) continue;
      const hostname = new URL(pageUrl).hostname;
      pages[pageUrl] = sanitizeInlineRuntimeSettings(pageValue, {
        ...(domains[hostname] ?? allUrls),
        domain: hostname,
        pageUrl,
      });
    }
  }

  return {
    schemaVersion: INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION,
    generatedAt:
      typeof raw.generatedAt === "string" && raw.generatedAt.trim()
        ? raw.generatedAt
        : new Date().toISOString(),
    scopes: {
      allUrls,
      domains,
      pages,
    },
  };
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
