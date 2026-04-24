import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const distMigrationsDirectory = path.join(currentDirectory, "migrations");
const sourceMigrationsDirectory = path.resolve(currentDirectory, "../../src/db/migrations");

function resolveMigrationsDirectory(): string {
  if (fs.existsSync(distMigrationsDirectory)) {
    return distMigrationsDirectory;
  }

  return sourceMigrationsDirectory;
}

export interface MigrationExecutor {
  query(
    sqlText: string,
    params?: unknown[],
  ): Promise<Record<string, unknown>[]>;
  execute(sqlText: string): Promise<void>;
  withTransaction<T>(callback: (tx: MigrationExecutor) => Promise<T>): Promise<T>;
}

export async function applyMigrations(executor: MigrationExecutor): Promise<void> {
  const migrationsDirectory = resolveMigrationsDirectory();

  await executor.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at BIGINT NOT NULL
    );
  `);

  const files = fs
    .readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((leftFile, rightFile) => leftFile.localeCompare(rightFile));

  const appliedRows = await executor.query("SELECT id FROM schema_migrations");
  const appliedIds = new Set(
    appliedRows
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string"),
  );

  for (const fileName of files) {
    if (appliedIds.has(fileName)) {
      continue;
    }

    const absoluteFilePath = path.join(migrationsDirectory, fileName);
    const migrationSql = fs.readFileSync(absoluteFilePath, "utf8");

    await executor.withTransaction(async (tx) => {
      await tx.execute(migrationSql);
      await tx.query(
        "INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)",
        [fileName, Date.now()],
      );
    });
  }
}
