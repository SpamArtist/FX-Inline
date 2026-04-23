import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const distMigrationsDirectory = path.join(currentDirectory, "migrations");
const sourceMigrationsDirectory = path.resolve(currentDirectory, "../../src/db/migrations");

function resolveMigrationsDirectory(): string {
  if (fs.existsSync(distMigrationsDirectory)) {
    return distMigrationsDirectory;
  }

  return sourceMigrationsDirectory;
}

interface MigrationRow {
  id: string;
}

export function applyMigrations(database: DatabaseSync): void {
  const migrationsDirectory = resolveMigrationsDirectory();

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const files = fs
    .readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((leftFile, rightFile) => leftFile.localeCompare(rightFile));

  const appliedIds = new Set(
    (database
      .prepare("SELECT id FROM schema_migrations")
      .all() as unknown as MigrationRow[])
      .map((row) => row.id),
  );

  for (const fileName of files) {
    if (appliedIds.has(fileName)) {
      continue;
    }

    const absoluteFilePath = path.join(migrationsDirectory, fileName);
    const migrationSql = fs.readFileSync(absoluteFilePath, "utf8");

    database.exec("BEGIN");

    try {
      database.exec(migrationSql);
      database
        .prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
        .run(fileName, Date.now());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
