import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.join(currentDirectory, "migrations");

export function applyMigrations(database) {
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
    database
      .prepare("SELECT id FROM schema_migrations")
      .all()
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
