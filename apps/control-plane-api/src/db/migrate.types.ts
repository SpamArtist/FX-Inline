export interface MigrationExecutor {
  query(
    sqlText: string,
    params?: unknown[],
  ): Promise<Record<string, unknown>[]>;
  execute(sqlText: string): Promise<void>;
  withTransaction<T>(callback: (tx: MigrationExecutor) => Promise<T>): Promise<T>;
}
