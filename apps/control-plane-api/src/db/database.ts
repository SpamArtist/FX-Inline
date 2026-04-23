import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyMigrations } from "./migrate.js";
import { createId } from "../utils/ids.js";
import { parseJsonSafe } from "../utils/json.js";
import { nowMs } from "../utils/time.js";
import type {
  AuditEventRecord,
  ClientMembershipRecord,
  ClientRecord,
  ClientWithRole,
  DatabaseApi,
  ManifestVersionRecord,
  MembershipRole,
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

interface UserRow {
  id: string;
  email: string;
  clerk_user_id: string | null;
  display_name: string;
  created_at: number;
}

interface ClientRow {
  id: string;
  slug: string;
  name: string;
  preferred_currency: string;
  allowed_origins_json: string;
  allowed_paths_json: string;
  created_at: number;
}

interface ClientWithRoleRow extends ClientRow {
  role: MembershipRole;
}

interface MembershipRow {
  client_id: string;
  user_id: string;
  role: MembershipRole;
  created_at: number;
}

interface SessionRow {
  id: string;
  user_id: string;
  clerk_session_id: string | null;
  csrf_token: string;
  expires_at: number;
  created_at: number;
}

interface SettingsVersionRow {
  id: string;
  client_id: string;
  version: number;
  settings_json: string;
  created_by_user_id: string | null;
  created_at: number;
}

interface PluginArtifactRow {
  id: string;
  client_id: string;
  kind: PluginKind;
  version: number;
  artifact_url: string;
  integrity: string;
  status: PluginArtifactStatus;
  created_by_user_id: string | null;
  created_at: number;
}

interface ManifestVersionRow {
  version: number;
}

function rowToSettingsVersion(row: SettingsVersionRow | null | undefined): SettingsVersionRecord | null {
  if (!row) return null;

  return {
    id: row.id,
    clientId: row.client_id,
    version: row.version,
    settings: parseJsonSafe<UiSettings>(row.settings_json, {
      fontScalePct: 90,
      fontWeight: 600,
      fontFamily: "inherit",
      fontColor: "#355aa8",
      spacingEm: 0.1,
    }),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function rowToPluginArtifact(row: PluginArtifactRow | null | undefined): PluginArtifactRecord | null {
  if (!row) return null;

  return {
    id: row.id,
    clientId: row.client_id,
    kind: row.kind,
    version: row.version,
    artifactUrl: row.artifact_url,
    integrity: row.integrity,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function rowToClient(row: ClientRow | null | undefined): ClientRecord | null {
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    preferredCurrency: row.preferred_currency,
    allowedOrigins: parseJsonSafe<string[]>(row.allowed_origins_json, []),
    allowedPaths: parseJsonSafe<string[]>(row.allowed_paths_json, []),
    createdAt: row.created_at,
  };
}

function rowToUser(row: UserRow | null | undefined): UserRecord | null {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    clerkUserId: row.clerk_user_id,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export function createDatabase({ dbPath }: { dbPath: string }): DatabaseApi {
  ensureParentDirectory(dbPath);
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(database);

  function runTransaction<T>(callback: () => T): T {
    database.exec("BEGIN");

    try {
      const result = callback();
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  function createUser({
    email,
    clerkUserId,
    displayName,
  }: {
    email: string;
    clerkUserId: string | null;
    displayName: string;
  }): UserRecord {
    const record: UserRecord = {
      id: createId("usr"),
      email,
      clerkUserId,
      displayName,
      createdAt: nowMs(),
    };

    database
      .prepare(
        `INSERT INTO users (id, email, clerk_user_id, display_name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.email,
        record.clerkUserId,
        record.displayName,
        record.createdAt,
      );

    return record;
  }

  function updateUserIdentity({
    userId,
    email,
    displayName,
    clerkUserId,
  }: {
    userId: string;
    email: string;
    displayName: string;
    clerkUserId: string;
  }): UserRecord {
    database
      .prepare(
        `UPDATE users
         SET email = ?, display_name = ?, clerk_user_id = ?
         WHERE id = ?`,
      )
      .run(email, displayName, clerkUserId, userId);

    const updated = findUserById(userId);
    if (!updated) {
      throw new Error("Failed to load updated user identity");
    }

    return updated;
  }

  function findUserByEmail(email: string): UserRecord | null {
    const row = database
      .prepare(
        `SELECT id, email, clerk_user_id, display_name, created_at
         FROM users WHERE lower(email) = lower(?)`,
      )
      .get(email) as UserRow | undefined;

    return rowToUser(row);
  }

  function findUserByClerkUserId(clerkUserId: string): UserRecord | null {
    const row = database
      .prepare(
        `SELECT id, email, clerk_user_id, display_name, created_at
         FROM users WHERE clerk_user_id = ?`,
      )
      .get(clerkUserId) as UserRow | undefined;

    return rowToUser(row);
  }

  function findUserById(userId: string): UserRecord | null {
    const row = database
      .prepare(
        `SELECT id, email, clerk_user_id, display_name, created_at
         FROM users WHERE id = ?`,
      )
      .get(userId) as UserRow | undefined;

    return rowToUser(row);
  }

  function createClient({
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
  }): ClientRecord {
    const record: ClientRecord = {
      id: createId("clt"),
      slug,
      name,
      preferredCurrency,
      allowedOrigins,
      allowedPaths,
      createdAt: nowMs(),
    };

    database
      .prepare(
        `INSERT INTO clients (
          id,
          slug,
          name,
          preferred_currency,
          allowed_origins_json,
          allowed_paths_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.slug,
        record.name,
        record.preferredCurrency,
        asJson(record.allowedOrigins),
        asJson(record.allowedPaths),
        record.createdAt,
      );

    return record;
  }

  function findClientById(clientId: string): ClientRecord | null {
    const row = database
      .prepare(
        `SELECT id, slug, name, preferred_currency, allowed_origins_json, allowed_paths_json, created_at
         FROM clients WHERE id = ?`,
      )
      .get(clientId) as ClientRow | undefined;

    return rowToClient(row);
  }

  function findClientBySlug(slug: string): ClientRecord | null {
    const row = database
      .prepare(
        `SELECT id, slug, name, preferred_currency, allowed_origins_json, allowed_paths_json, created_at
         FROM clients WHERE slug = ?`,
      )
      .get(slug) as ClientRow | undefined;

    return rowToClient(row);
  }

  function listClientsForUser(userId: string): ClientWithRole[] {
    const rows = database
      .prepare(
        `SELECT c.id, c.slug, c.name, c.preferred_currency, c.allowed_origins_json, c.allowed_paths_json, c.created_at, m.role
         FROM clients c
         INNER JOIN client_members m ON m.client_id = c.id
         WHERE m.user_id = ?
         ORDER BY c.created_at ASC`,
      )
      .all(userId) as unknown as ClientWithRoleRow[];

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      preferredCurrency: row.preferred_currency,
      allowedOrigins: parseJsonSafe<string[]>(row.allowed_origins_json, []),
      allowedPaths: parseJsonSafe<string[]>(row.allowed_paths_json, []),
      createdAt: row.created_at,
      role: row.role,
    }));
  }

  function addClientMember({
    clientId,
    userId,
    role,
  }: {
    clientId: string;
    userId: string;
    role: MembershipRole;
  }): void {
    database
      .prepare(
        `INSERT INTO client_members (client_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(clientId, userId, role, nowMs());
  }

  function findClientMembership({
    clientId,
    userId,
  }: {
    clientId: string;
    userId: string;
  }): ClientMembershipRecord | null {
    const row = database
      .prepare(
        `SELECT client_id, user_id, role, created_at
         FROM client_members WHERE client_id = ? AND user_id = ?`,
      )
      .get(clientId, userId) as MembershipRow | undefined;

    if (!row) return null;

    return {
      clientId: row.client_id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  function createSession({
    userId,
    clerkSessionId,
    csrfToken,
    expiresAt,
  }: {
    userId: string;
    clerkSessionId: string | null;
    csrfToken: string;
    expiresAt: number;
  }): SessionRecord {
    const session: SessionRecord = {
      id: createId("ses"),
      userId,
      clerkSessionId,
      csrfToken,
      expiresAt,
      createdAt: nowMs(),
    };

    database
      .prepare(
        `INSERT INTO sessions (id, user_id, clerk_session_id, csrf_token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.userId,
        session.clerkSessionId,
        session.csrfToken,
        session.expiresAt,
        session.createdAt,
      );

    return session;
  }

  function findSession(sessionId: string): SessionRecord | null {
    const row = database
      .prepare(
        `SELECT id, user_id, clerk_session_id, csrf_token, expires_at, created_at
         FROM sessions WHERE id = ?`,
      )
      .get(sessionId) as SessionRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      clerkSessionId: row.clerk_session_id,
      csrfToken: row.csrf_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }

  function deleteSession(sessionId: string): void {
    database.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  function deleteExpiredSessions(): void {
    database
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(nowMs());
  }

  function getLatestSettingsVersion(clientId: string): SettingsVersionRecord | null {
    const row = database
      .prepare(
        `SELECT id, client_id, version, settings_json, created_by_user_id, created_at
         FROM client_settings_versions
         WHERE client_id = ?
         ORDER BY version DESC
         LIMIT 1`,
      )
      .get(clientId) as SettingsVersionRow | undefined;

    return rowToSettingsVersion(row);
  }

  function createSettingsVersion({
    clientId,
    settings,
    createdByUserId,
  }: {
    clientId: string;
    settings: UiSettings;
    createdByUserId: string | null;
  }): SettingsVersionRecord {
    const latest = getLatestSettingsVersion(clientId);

    const nextVersion = latest ? latest.version + 1 : 1;
    const record: SettingsVersionRecord = {
      id: createId("set"),
      clientId,
      version: nextVersion,
      settings,
      createdByUserId,
      createdAt: nowMs(),
    };

    database
      .prepare(
        `INSERT INTO client_settings_versions (
          id,
          client_id,
          version,
          settings_json,
          created_by_user_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.clientId,
        record.version,
        asJson(record.settings),
        record.createdByUserId,
        record.createdAt,
      );

    return record;
  }

  function getLatestPluginArtifact({
    clientId,
    kind,
  }: {
    clientId: string;
    kind: PluginKind;
  }): PluginArtifactRecord | null {
    const row = database
      .prepare(
        `SELECT id, client_id, kind, version, artifact_url, integrity, status, created_by_user_id, created_at
         FROM plugin_artifacts
         WHERE client_id = ? AND kind = ? AND status = 'approved'
         ORDER BY version DESC
         LIMIT 1`,
      )
      .get(clientId, kind) as PluginArtifactRow | undefined;

    return rowToPluginArtifact(row);
  }

  function createPluginArtifact({
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
  }): PluginArtifactRecord {
    const latest = getLatestPluginArtifact({ clientId, kind });
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

    database
      .prepare(
        `INSERT INTO plugin_artifacts (
          id,
          client_id,
          kind,
          version,
          artifact_url,
          integrity,
          status,
          created_by_user_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.clientId,
        record.kind,
        record.version,
        record.artifactUrl,
        record.integrity,
        record.status,
        record.createdByUserId,
        record.createdAt,
      );

    return record;
  }

  function createManifestVersion({
    clientId,
    manifest,
    signature,
    keyId,
  }: {
    clientId: string;
    manifest: RuntimeManifest;
    signature: string;
    keyId: string;
  }): ManifestVersionRecord {
    const latest = database
      .prepare(
        `SELECT version FROM manifest_versions
         WHERE client_id = ?
         ORDER BY version DESC
         LIMIT 1`,
      )
      .get(clientId) as ManifestVersionRow | undefined;

    const nextVersion = latest ? latest.version + 1 : 1;

    const record: ManifestVersionRecord = {
      id: createId("mfs"),
      clientId,
      version: nextVersion,
      manifest,
      signature,
      keyId,
      createdAt: nowMs(),
    };

    database
      .prepare(
        `INSERT INTO manifest_versions (
          id,
          client_id,
          version,
          manifest_json,
          signature,
          key_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.clientId,
        record.version,
        asJson(record.manifest),
        record.signature,
        record.keyId,
        record.createdAt,
      );

    return record;
  }

  function createAuditEvent({
    clientId = null,
    userId = null,
    eventType,
    payload = null,
  }: {
    clientId?: string | null;
    userId?: string | null;
    eventType: string;
    payload?: Record<string, unknown> | null;
  }): AuditEventRecord {
    const record: AuditEventRecord = {
      id: createId("aud"),
      clientId,
      userId,
      eventType,
      payload,
      createdAt: nowMs(),
    };

    database
      .prepare(
        `INSERT INTO audit_events (
          id,
          client_id,
          user_id,
          event_type,
          payload_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.clientId,
        record.userId,
        record.eventType,
        record.payload ? asJson(record.payload) : null,
        record.createdAt,
      );

    return record;
  }

  function seedDemoData(): ClientRecord {
    const existingClient = findClientBySlug("acme");
    if (existingClient) return existingClient;

    const client = createClient({
      slug: "acme",
      name: "ACME Inc",
      preferredCurrency: "USD",
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
      allowedPaths: ["^/b2b-demo(?:/|$)", "^/pricing(?:/|$)", "^/store(?:/|$)"],
    });

    createSettingsVersion({
      clientId: client.id,
      settings: {
        fontScalePct: 90,
        fontWeight: 600,
        fontFamily: "inherit",
        fontColor: "#355aa8",
        spacingEm: 0.1,
      },
      createdByUserId: null,
    });

    createPluginArtifact({
      clientId: client.id,
      kind: "pre",
      artifactUrl: "/b2b/clients/acme/pre.v1.js",
      integrity: "sha256-lu7Y8YbmNXtJXmVFJbtzZgMRjTukAv/Adu+yXIB/qgw=",
      createdByUserId: null,
      status: "approved",
    });

    createPluginArtifact({
      clientId: client.id,
      kind: "post",
      artifactUrl: "/b2b/clients/acme/post.v1.js",
      integrity: "sha256-xYRtIxxmKh/DhPVMKEMgwzr4p65nSJvO1V8NPcabXAA=",
      createdByUserId: null,
      status: "approved",
    });

    return client;
  }

  return {
    database,
    createUser,
    updateUserIdentity,
    findUserByEmail,
    findUserByClerkUserId,
    findUserById,
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
    seedDemoData,
    runTransaction,
  };
}
