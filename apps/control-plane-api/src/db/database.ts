import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { type PoolClient, type QueryResultRow, Pool } from "pg";
import { applyMigrations } from "./migrate.js";
import type { DrizzleDb } from "./database.types.js";
import type { MigrationExecutor } from "./migrate.types.js";
import {
  allowedEmailDomainsTable,
  auditEventsTable,
  clientMembersTable,
  clientsTable,
  clientSettingsVersionsTable,
  controlPlaneSchema,
  manifestVersionsTable,
  platformAdminIdentitiesTable,
  pluginArtifactsTable,
  sessionsTable,
  usersTable,
} from "./schema.js";
import { createId } from "../utils/ids.js";
import { parseJsonSafe } from "../utils/json.js";
import { nowMs } from "../utils/time.js";
import type {
  AllowedEmailDomainRecord,
  AuditEventRecord,
  ClientMembershipRecord,
  ClientRecord,
  ClientWithRole,
  DatabaseApi,
  ManifestVersionRecord,
  MembershipRole,
  PlatformAdminIdentityRecord,
  PluginArtifactRecord,
  PluginArtifactStatus,
  PluginKind,
  RuntimeManifest,
  SessionRecord,
  SettingsVersionRecord,
  UiSettings,
  UserRecord,
} from "../types.js";

function ensureParentDirectory(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function asJson(value: unknown): string {
  return JSON.stringify(value);
}

function toUserRecord(row: typeof usersTable.$inferSelect | null | undefined): UserRecord | null {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    clerkUserId: row.clerkUserId,
    displayName: row.displayName ?? "",
    createdAt: row.createdAt,
  };
}

function toPlatformAdminIdentityRecord(
  row: typeof platformAdminIdentitiesTable.$inferSelect | null | undefined,
): PlatformAdminIdentityRecord | null {
  if (!row) return null;

  return {
    email: row.email,
    clerkUserId: row.clerkUserId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAllowedEmailDomainRecord(
  row: typeof allowedEmailDomainsTable.$inferSelect | null | undefined,
): AllowedEmailDomainRecord | null {
  if (!row) return null;

  return {
    domain: row.domain,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

function toClientRecord(row: typeof clientsTable.$inferSelect | null | undefined): ClientRecord | null {
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    preferredCurrency: row.preferredCurrency,
    allowedOrigins: parseJsonSafe<string[]>(row.allowedOriginsJson, []),
    allowedPaths: parseJsonSafe<string[]>(row.allowedPathsJson, []),
    createdAt: row.createdAt,
  };
}

function toSettingsVersionRecord(
  row: typeof clientSettingsVersionsTable.$inferSelect | null | undefined,
): SettingsVersionRecord | null {
  if (!row) return null;

  return {
    id: row.id,
    clientId: row.clientId,
    version: row.version,
    settings: parseJsonSafe<UiSettings>(row.settingsJson, {
      fontScalePct: 90,
      fontWeight: 600,
      fontFamily: "inherit",
      fontColor: "#355aa8",
      spacingEm: 0.1,
    }),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

function toPluginArtifactRecord(
  row: typeof pluginArtifactsTable.$inferSelect | null | undefined,
): PluginArtifactRecord | null {
  if (!row) return null;

  return {
    id: row.id,
    clientId: row.clientId,
    kind: row.kind as PluginKind,
    version: row.version,
    artifactUrl: row.artifactUrl,
    integrity: row.integrity,
    status: row.status as PluginArtifactStatus,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

function toSessionRecord(row: typeof sessionsTable.$inferSelect | null | undefined): SessionRecord | null {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    clerkSessionId: row.clerkSessionId,
    csrfToken: row.csrfToken,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

function toMembershipRecord(
  row: typeof clientMembersTable.$inferSelect | null | undefined,
): ClientMembershipRecord | null {
  if (!row) return null;

  return {
    clientId: row.clientId,
    userId: row.userId,
    role: row.role as MembershipRole,
    createdAt: row.createdAt,
  };
}

async function queryPgRows<T extends QueryResultRow>(
  client: Pool | PoolClient,
  sqlText: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await client.query<T>(sqlText, params);
  return result.rows;
}

async function queryPgliteRows<T extends Record<string, unknown>>(
  database: PGlite,
  sqlText: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await database.query<T>(sqlText, params);
  if (Array.isArray(result)) {
    return result;
  }

  const withRows = result as { rows?: T[] };
  return withRows.rows ?? [];
}

function createDatabaseApi({
  db,
  close,
  runInTransaction,
}: {
  db: DrizzleDb;
  close: () => Promise<void>;
  runInTransaction: <T>(callback: (txDb: DrizzleDb) => Promise<T>) => Promise<T>;
}): DatabaseApi {
  async function createUser({
    email,
    clerkUserId,
    displayName,
  }: {
    email: string;
    clerkUserId: string | null;
    displayName: string;
  }): Promise<UserRecord> {
    const record: UserRecord = {
      id: createId("usr"),
      email,
      clerkUserId,
      displayName,
      createdAt: nowMs(),
    };

    await db.insert(usersTable).values({
      id: record.id,
      email: record.email,
      clerkUserId: record.clerkUserId,
      displayName: record.displayName,
      createdAt: record.createdAt,
    });

    return record;
  }

  async function updateUserIdentity({
    userId,
    email,
    displayName,
    clerkUserId,
  }: {
    userId: string;
    email: string;
    displayName: string;
    clerkUserId: string;
  }): Promise<UserRecord> {
    await db
      .update(usersTable)
      .set({
        email,
        displayName,
        clerkUserId,
      })
      .where(eq(usersTable.id, userId));

    const updated = await findUserById(userId);
    if (!updated) {
      throw new Error("Failed to load updated user identity");
    }

    return updated;
  }

  async function findUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = await db
      .select()
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = lower(${email})`)
      .limit(1);

    return toUserRecord(rows[0]);
  }

  async function findUserByClerkUserId(clerkUserId: string): Promise<UserRecord | null> {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, clerkUserId))
      .limit(1);

    return toUserRecord(rows[0]);
  }

  async function findUserById(userId: string): Promise<UserRecord | null> {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    return toUserRecord(rows[0]);
  }

  async function upsertPlatformAdminIdentity({
    email,
    clerkUserId,
    createdByUserId,
  }: {
    email: string;
    clerkUserId: string | null;
    createdByUserId: string | null;
  }): Promise<PlatformAdminIdentityRecord> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedClerkUserId =
      typeof clerkUserId === "string" && clerkUserId.trim().length ? clerkUserId.trim() : null;
    const timestamp = nowMs();

    const existingRows = await db
      .select()
      .from(platformAdminIdentitiesTable)
      .where(sql`lower(${platformAdminIdentitiesTable.email}) = lower(${normalizedEmail})`)
      .limit(1);

    const existing = existingRows[0];
    if (!existing) {
      const record: PlatformAdminIdentityRecord = {
        email: normalizedEmail,
        clerkUserId: normalizedClerkUserId,
        createdByUserId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await db.insert(platformAdminIdentitiesTable).values({
        email: record.email,
        clerkUserId: record.clerkUserId,
        createdByUserId: record.createdByUserId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });

      return record;
    }

    const nextClerkUserId = normalizedClerkUserId ?? existing.clerkUserId ?? null;
    const nextCreatedByUserId = createdByUserId ?? existing.createdByUserId ?? null;

    await db
      .update(platformAdminIdentitiesTable)
      .set({
        clerkUserId: nextClerkUserId,
        createdByUserId: nextCreatedByUserId,
        updatedAt: timestamp,
      })
      .where(eq(platformAdminIdentitiesTable.email, existing.email));

    return {
      email: existing.email,
      clerkUserId: nextClerkUserId,
      createdByUserId: nextCreatedByUserId,
      createdAt: existing.createdAt,
      updatedAt: timestamp,
    };
  }

  async function isPlatformAdminByIdentity({
    email,
    clerkUserId,
  }: {
    email: string;
    clerkUserId?: string | null;
  }): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedClerkUserId =
      typeof clerkUserId === "string" && clerkUserId.trim().length ? clerkUserId.trim() : null;

    const rows = await db
      .select()
      .from(platformAdminIdentitiesTable)
      .where(sql`lower(${platformAdminIdentitiesTable.email}) = lower(${normalizedEmail})`)
      .limit(1);

    const matched = toPlatformAdminIdentityRecord(rows[0]);
    if (!matched) {
      return false;
    }

    if (
      matched.clerkUserId &&
      normalizedClerkUserId &&
      matched.clerkUserId !== normalizedClerkUserId
    ) {
      return false;
    }

    if (!matched.clerkUserId && normalizedClerkUserId) {
      await db
        .update(platformAdminIdentitiesTable)
        .set({
          clerkUserId: normalizedClerkUserId,
          updatedAt: nowMs(),
        })
        .where(eq(platformAdminIdentitiesTable.email, matched.email));
    }

    return true;
  }

  async function listAllowedEmailDomains(): Promise<AllowedEmailDomainRecord[]> {
    const rows = await db
      .select()
      .from(allowedEmailDomainsTable)
      .orderBy(asc(allowedEmailDomainsTable.domain));

    return rows
      .map((row) => toAllowedEmailDomainRecord(row))
      .filter((row): row is AllowedEmailDomainRecord => Boolean(row));
  }

  async function addAllowedEmailDomain({
    domain,
    createdByUserId,
  }: {
    domain: string;
    createdByUserId: string | null;
  }): Promise<AllowedEmailDomainRecord> {
    const normalizedDomain = domain.trim().toLowerCase();

    const existingRows = await db
      .select()
      .from(allowedEmailDomainsTable)
      .where(eq(allowedEmailDomainsTable.domain, normalizedDomain))
      .limit(1);

    const existing = toAllowedEmailDomainRecord(existingRows[0]);
    if (existing) {
      return existing;
    }

    const record: AllowedEmailDomainRecord = {
      domain: normalizedDomain,
      createdByUserId,
      createdAt: nowMs(),
    };

    await db.insert(allowedEmailDomainsTable).values({
      domain: record.domain,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
    });

    return record;
  }

  async function removeAllowedEmailDomain(domain: string): Promise<boolean> {
    const normalizedDomain = domain.trim().toLowerCase();
    const deletedRows = await db
      .delete(allowedEmailDomainsTable)
      .where(eq(allowedEmailDomainsTable.domain, normalizedDomain))
      .returning();

    return deletedRows.length > 0;
  }

  async function createClient({
    slug,
    name,
    preferredCurrency,
    allowedOrigins,
    allowedPaths,
  }: {
    slug: string;
    name: string;
    preferredCurrency: string;
    allowedOrigins: string[];
    allowedPaths: string[];
  }): Promise<ClientRecord> {
    const record: ClientRecord = {
      id: createId("clt"),
      slug,
      name,
      preferredCurrency,
      allowedOrigins,
      allowedPaths,
      createdAt: nowMs(),
    };

    await db.insert(clientsTable).values({
      id: record.id,
      slug: record.slug,
      name: record.name,
      preferredCurrency: record.preferredCurrency,
      allowedOriginsJson: asJson(record.allowedOrigins),
      allowedPathsJson: asJson(record.allowedPaths),
      createdAt: record.createdAt,
    });

    return record;
  }

  async function findClientById(clientId: string): Promise<ClientRecord | null> {
    const rows = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId))
      .limit(1);

    return toClientRecord(rows[0]);
  }

  async function findClientBySlug(slug: string): Promise<ClientRecord | null> {
    const rows = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.slug, slug))
      .limit(1);

    return toClientRecord(rows[0]);
  }

  async function listClientsForUser(userId: string): Promise<ClientWithRole[]> {
    const rows = await db
      .select({
        id: clientsTable.id,
        slug: clientsTable.slug,
        name: clientsTable.name,
        preferredCurrency: clientsTable.preferredCurrency,
        allowedOriginsJson: clientsTable.allowedOriginsJson,
        allowedPathsJson: clientsTable.allowedPathsJson,
        createdAt: clientsTable.createdAt,
        role: clientMembersTable.role,
      })
      .from(clientsTable)
      .innerJoin(clientMembersTable, eq(clientMembersTable.clientId, clientsTable.id))
      .where(eq(clientMembersTable.userId, userId))
      .orderBy(asc(clientsTable.createdAt));

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      preferredCurrency: row.preferredCurrency,
      allowedOrigins: parseJsonSafe<string[]>(row.allowedOriginsJson, []),
      allowedPaths: parseJsonSafe<string[]>(row.allowedPathsJson, []),
      createdAt: row.createdAt,
      role: row.role as MembershipRole,
    }));
  }

  async function addClientMember({
    clientId,
    userId,
    role,
  }: {
    clientId: string;
    userId: string;
    role: MembershipRole;
  }): Promise<void> {
    await db.insert(clientMembersTable).values({
      clientId,
      userId,
      role,
      createdAt: nowMs(),
    });
  }

  async function findClientMembership({
    clientId,
    userId,
  }: {
    clientId: string;
    userId: string;
  }): Promise<ClientMembershipRecord | null> {
    const rows = await db
      .select()
      .from(clientMembersTable)
      .where(and(eq(clientMembersTable.clientId, clientId), eq(clientMembersTable.userId, userId)))
      .limit(1);

    return toMembershipRecord(rows[0]);
  }

  async function createSession({
    userId,
    clerkSessionId,
    csrfToken,
    expiresAt,
  }: {
    userId: string;
    clerkSessionId: string | null;
    csrfToken: string;
    expiresAt: number;
  }): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: createId("ses"),
      userId,
      clerkSessionId,
      csrfToken,
      expiresAt,
      createdAt: nowMs(),
    };

    await db.insert(sessionsTable).values({
      id: session.id,
      userId: session.userId,
      clerkSessionId: session.clerkSessionId,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    });

    return session;
  }

  async function findSession(sessionId: string): Promise<SessionRecord | null> {
    const rows = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    return toSessionRecord(rows[0]);
  }

  async function deleteSession(sessionId: string): Promise<void> {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
  }

  async function deleteExpiredSessions(): Promise<void> {
    await db.delete(sessionsTable).where(lte(sessionsTable.expiresAt, nowMs()));
  }

  async function getLatestSettingsVersion(clientId: string): Promise<SettingsVersionRecord | null> {
    const rows = await db
      .select()
      .from(clientSettingsVersionsTable)
      .where(eq(clientSettingsVersionsTable.clientId, clientId))
      .orderBy(desc(clientSettingsVersionsTable.version))
      .limit(1);

    return toSettingsVersionRecord(rows[0]);
  }

  async function createSettingsVersion({
    clientId,
    settings,
    createdByUserId,
  }: {
    clientId: string;
    settings: UiSettings;
    createdByUserId: string | null;
  }): Promise<SettingsVersionRecord> {
    const latest = await getLatestSettingsVersion(clientId);
    const nextVersion = latest ? latest.version + 1 : 1;

    const record: SettingsVersionRecord = {
      id: createId("set"),
      clientId,
      version: nextVersion,
      settings,
      createdByUserId,
      createdAt: nowMs(),
    };

    await db.insert(clientSettingsVersionsTable).values({
      id: record.id,
      clientId: record.clientId,
      version: record.version,
      settingsJson: asJson(record.settings),
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
    });

    return record;
  }

  async function getLatestPluginArtifact({
    clientId,
    kind,
  }: {
    clientId: string;
    kind: PluginKind;
  }): Promise<PluginArtifactRecord | null> {
    const rows = await db
      .select()
      .from(pluginArtifactsTable)
      .where(
        and(
          eq(pluginArtifactsTable.clientId, clientId),
          eq(pluginArtifactsTable.kind, kind),
          eq(pluginArtifactsTable.status, "approved"),
        ),
      )
      .orderBy(desc(pluginArtifactsTable.version))
      .limit(1);

    return toPluginArtifactRecord(rows[0]);
  }

  async function createPluginArtifact({
    clientId,
    kind,
    artifactUrl,
    integrity,
    createdByUserId,
    status = "approved",
  }: {
    clientId: string;
    kind: PluginKind;
    artifactUrl: string;
    integrity: string;
    createdByUserId: string | null;
    status?: PluginArtifactStatus;
  }): Promise<PluginArtifactRecord> {
    const latest = await getLatestPluginArtifact({ clientId, kind });
    const nextVersion = latest ? latest.version + 1 : 1;

    const record: PluginArtifactRecord = {
      id: createId("plg"),
      clientId,
      kind,
      version: nextVersion,
      artifactUrl,
      integrity,
      status,
      createdByUserId,
      createdAt: nowMs(),
    };

    await db.insert(pluginArtifactsTable).values({
      id: record.id,
      clientId: record.clientId,
      kind: record.kind,
      version: record.version,
      artifactUrl: record.artifactUrl,
      integrity: record.integrity,
      status: record.status,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
    });

    return record;
  }

  async function createManifestVersion({
    clientId,
    manifest,
    signature,
    keyId,
  }: {
    clientId: string;
    manifest: RuntimeManifest;
    signature: string;
    keyId: string;
  }): Promise<ManifestVersionRecord> {
    const latestRows = await db
      .select({ version: manifestVersionsTable.version })
      .from(manifestVersionsTable)
      .where(eq(manifestVersionsTable.clientId, clientId))
      .orderBy(desc(manifestVersionsTable.version))
      .limit(1);

    const nextVersion = latestRows[0] ? latestRows[0].version + 1 : 1;

    const record: ManifestVersionRecord = {
      id: createId("mfs"),
      clientId,
      version: nextVersion,
      manifest,
      signature,
      keyId,
      createdAt: nowMs(),
    };

    await db.insert(manifestVersionsTable).values({
      id: record.id,
      clientId: record.clientId,
      version: record.version,
      manifestJson: asJson(record.manifest),
      signature: record.signature,
      keyId: record.keyId,
      createdAt: record.createdAt,
    });

    return record;
  }

  async function createAuditEvent({
    clientId = null,
    userId = null,
    eventType,
    payload = null,
  }: {
    clientId?: string | null;
    userId?: string | null;
    eventType: string;
    payload?: Record<string, unknown> | null;
  }): Promise<AuditEventRecord> {
    const record: AuditEventRecord = {
      id: createId("aud"),
      clientId,
      userId,
      eventType,
      payload,
      createdAt: nowMs(),
    };

    await db.insert(auditEventsTable).values({
      id: record.id,
      clientId: record.clientId,
      userId: record.userId,
      eventType: record.eventType,
      payloadJson: record.payload ? asJson(record.payload) : null,
      createdAt: record.createdAt,
    });

    return record;
  }

  async function runTransaction<T>(callback: (tx: DatabaseApi) => Promise<T>): Promise<T> {
    return runInTransaction(async (txDb) => {
      const txApi = createDatabaseApi({
        db: txDb,
        close: async () => {},
        runInTransaction: async <U>(nestedCallback: (nestedTxDb: DrizzleDb) => Promise<U>) =>
          nestedCallback(txDb),
      });
      return callback(txApi);
    });
  }

  return {
    close,
    createUser,
    updateUserIdentity,
    findUserByEmail,
    findUserByClerkUserId,
    findUserById,
    upsertPlatformAdminIdentity,
    isPlatformAdminByIdentity,
    listAllowedEmailDomains,
    addAllowedEmailDomain,
    removeAllowedEmailDomain,
    createClient,
    findClientById,
    findClientBySlug,
    listClientsForUser,
    addClientMember,
    findClientMembership,
    createSession,
    findSession,
    deleteSession,
    deleteExpiredSessions,
    getLatestSettingsVersion,
    createSettingsVersion,
    getLatestPluginArtifact,
    createPluginArtifact,
    createManifestVersion,
    createAuditEvent,
    runTransaction,
  };
}

export async function createDatabase({
  databaseUrl,
}: {
  databaseUrl: string;
}): Promise<DatabaseApi> {
  if (databaseUrl.startsWith("pglite://")) {
    const pgliteTarget = databaseUrl.slice("pglite://".length);
    const pglite =
      !pgliteTarget.length || pgliteTarget === ":memory:"
        ? new PGlite()
        : (() => {
          ensureParentDirectory(pgliteTarget);
          return new PGlite(pgliteTarget);
        })();

    const migrationExecutor: MigrationExecutor = {
      query: async (sqlText: string, params: unknown[] = []) =>
        queryPgliteRows<Record<string, unknown>>(pglite, sqlText, params),
      execute: async (sqlText: string) => {
        await pglite.exec(sqlText);
      },
      withTransaction: async <T>(callback: (tx: MigrationExecutor) => Promise<T>) => {
        await pglite.exec("BEGIN");
        try {
          const txExecutor: MigrationExecutor = {
            query: async (
              sqlText: string,
              params: unknown[] = [],
            ) => queryPgliteRows<Record<string, unknown>>(pglite, sqlText, params),
            execute: async (sqlText: string) => {
              await pglite.exec(sqlText);
            },
            withTransaction: async <U>(txCallback: (tx: MigrationExecutor) => Promise<U>) =>
              txCallback(txExecutor),
          };
          const result = await callback(txExecutor);
          await pglite.exec("COMMIT");
          return result;
        } catch (error) {
          await pglite.exec("ROLLBACK");
          throw error;
        }
      },
    };

    await applyMigrations(migrationExecutor);

    const db = drizzlePglite(pglite, { schema: controlPlaneSchema });

    return createDatabaseApi({
      db,
      close: async () => {
        if (typeof pglite.close === "function") {
          await pglite.close();
        }
      },
      runInTransaction: async <T>(callback: (txDb: DrizzleDb) => Promise<T>) => {
        await pglite.exec("BEGIN");
        try {
          const txDb = drizzlePglite(pglite, { schema: controlPlaneSchema });
          const result = await callback(txDb);
          await pglite.exec("COMMIT");
          return result;
        } catch (error) {
          await pglite.exec("ROLLBACK");
          throw error;
        }
      },
    });
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const migrationExecutor: MigrationExecutor = {
    query: async (sqlText: string, params: unknown[] = []) =>
      queryPgRows<Record<string, unknown> & QueryResultRow>(pool, sqlText, params),
    execute: async (sqlText: string) => {
      await pool.query(sqlText);
    },
    withTransaction: async <T>(callback: (tx: MigrationExecutor) => Promise<T>) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txExecutor: MigrationExecutor = {
          query: async (sqlText: string, params: unknown[] = []) =>
            queryPgRows<Record<string, unknown> & QueryResultRow>(client, sqlText, params),
          execute: async (sqlText: string) => {
            await client.query(sqlText);
          },
          withTransaction: async <U>(txCallback: (tx: MigrationExecutor) => Promise<U>) =>
            txCallback(txExecutor),
        };

        const result = await callback(txExecutor);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };

  await applyMigrations(migrationExecutor);

  const db = drizzleNodePg(pool, { schema: controlPlaneSchema });

  return createDatabaseApi({
    db,
    close: async () => {
      await pool.end();
    },
    runInTransaction: async <T>(callback: (txDb: DrizzleDb) => Promise<T>) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txDb = drizzleNodePg(client, { schema: controlPlaneSchema });
        const result = await callback(txDb);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  });
}
