import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyMigrations } from "./migrate.mjs";
import { createId } from "../utils/ids.mjs";
import { parseJsonSafe } from "../utils/json.mjs";
import { nowMs } from "../utils/time.mjs";

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function asJson(value) {
  return JSON.stringify(value);
}

function rowToSettingsVersion(row) {
  if (!row) return null;

  return {
    id: row.id,
    clientId: row.client_id,
    version: row.version,
    settings: parseJsonSafe(row.settings_json, {}),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function rowToPluginArtifact(row) {
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

export function createDatabase({ dbPath }) {
  ensureParentDirectory(dbPath);
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(database);

  function runTransaction(callback) {
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

  function createUser({ email, passwordHash, displayName }) {
    const record = {
      id: createId("usr"),
      email,
      passwordHash,
      displayName,
      createdAt: nowMs(),
    };

    database
      .prepare(
        `INSERT INTO users (id, email, password_hash, display_name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.email,
        record.passwordHash,
        record.displayName,
        record.createdAt,
      );

    return record;
  }

  function findUserByEmail(email) {
    const row = database
      .prepare(
        `SELECT id, email, password_hash, display_name, created_at
         FROM users WHERE lower(email) = lower(?)`,
      )
      .get(email);

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      createdAt: row.created_at,
    };
  }

  function findUserById(userId) {
    const row = database
      .prepare(
        `SELECT id, email, password_hash, display_name, created_at
         FROM users WHERE id = ?`,
      )
      .get(userId);

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      createdAt: row.created_at,
    };
  }

  function createClient({ slug, name, preferredCurrency, allowedOrigins, allowedPaths }) {
    const record = {
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

  function findClientById(clientId) {
    const row = database
      .prepare(
        `SELECT id, slug, name, preferred_currency, allowed_origins_json, allowed_paths_json, created_at
         FROM clients WHERE id = ?`,
      )
      .get(clientId);

    if (!row) return null;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      preferredCurrency: row.preferred_currency,
      allowedOrigins: parseJsonSafe(row.allowed_origins_json, []),
      allowedPaths: parseJsonSafe(row.allowed_paths_json, []),
      createdAt: row.created_at,
    };
  }

  function findClientBySlug(slug) {
    const row = database
      .prepare(
        `SELECT id, slug, name, preferred_currency, allowed_origins_json, allowed_paths_json, created_at
         FROM clients WHERE slug = ?`,
      )
      .get(slug);

    if (!row) return null;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      preferredCurrency: row.preferred_currency,
      allowedOrigins: parseJsonSafe(row.allowed_origins_json, []),
      allowedPaths: parseJsonSafe(row.allowed_paths_json, []),
      createdAt: row.created_at,
    };
  }

  function listClientsForUser(userId) {
    const rows = database
      .prepare(
        `SELECT c.id, c.slug, c.name, c.preferred_currency, c.allowed_origins_json, c.allowed_paths_json, c.created_at, m.role
         FROM clients c
         INNER JOIN client_members m ON m.client_id = c.id
         WHERE m.user_id = ?
         ORDER BY c.created_at ASC`,
      )
      .all(userId);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      preferredCurrency: row.preferred_currency,
      allowedOrigins: parseJsonSafe(row.allowed_origins_json, []),
      allowedPaths: parseJsonSafe(row.allowed_paths_json, []),
      createdAt: row.created_at,
      role: row.role,
    }));
  }

  function addClientMember({ clientId, userId, role }) {
    database
      .prepare(
        `INSERT INTO client_members (client_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(clientId, userId, role, nowMs());
  }

  function findClientMembership({ clientId, userId }) {
    const row = database
      .prepare(
        `SELECT client_id, user_id, role, created_at
         FROM client_members WHERE client_id = ? AND user_id = ?`,
      )
      .get(clientId, userId);

    if (!row) return null;

    return {
      clientId: row.client_id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  function createSession({ userId, csrfToken, expiresAt }) {
    const session = {
      id: createId("ses"),
      userId,
      csrfToken,
      expiresAt,
      createdAt: nowMs(),
    };

    database
      .prepare(
        `INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.userId,
        session.csrfToken,
        session.expiresAt,
        session.createdAt,
      );

    return session;
  }

  function findSession(sessionId) {
    const row = database
      .prepare(
        `SELECT id, user_id, csrf_token, expires_at, created_at
         FROM sessions WHERE id = ?`,
      )
      .get(sessionId);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      csrfToken: row.csrf_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }

  function deleteSession(sessionId) {
    database.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  function deleteExpiredSessions() {
    database
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(nowMs());
  }

  function createOAuthState({ returnTo, expiresAt }) {
    const state = createId("st");
    const createdAt = nowMs();

    database
      .prepare(
        `INSERT INTO oauth_states (state, return_to, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(state, returnTo, expiresAt, createdAt);

    return {
      state,
      returnTo,
      expiresAt,
      createdAt,
    };
  }

  function consumeOAuthState(state) {
    return runTransaction(() => {
      const row = database
        .prepare(
          `SELECT state, return_to, expires_at, created_at
           FROM oauth_states WHERE state = ?`,
        )
        .get(state);

      if (!row) return null;

      database.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);

      return {
        state: row.state,
        returnTo: row.return_to,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      };
    });
  }

  function findOAuthIdentity({ provider, providerUserId }) {
    const row = database
      .prepare(
        `SELECT id, user_id, provider, provider_user_id, email, created_at
         FROM oauth_identities
         WHERE provider = ? AND provider_user_id = ?`,
      )
      .get(provider, providerUserId);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      providerUserId: row.provider_user_id,
      email: row.email,
      createdAt: row.created_at,
    };
  }

  function createOAuthIdentity({ userId, provider, providerUserId, email }) {
    const identity = {
      id: createId("oauth"),
      userId,
      provider,
      providerUserId,
      email,
      createdAt: nowMs(),
    };

    database
      .prepare(
        `INSERT INTO oauth_identities (
          id,
          user_id,
          provider,
          provider_user_id,
          email,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        identity.id,
        identity.userId,
        identity.provider,
        identity.providerUserId,
        identity.email,
        identity.createdAt,
      );

    return identity;
  }

  function getLatestSettingsVersion(clientId) {
    const row = database
      .prepare(
        `SELECT id, client_id, version, settings_json, created_by_user_id, created_at
         FROM client_settings_versions
         WHERE client_id = ?
         ORDER BY version DESC
         LIMIT 1`,
      )
      .get(clientId);

    return rowToSettingsVersion(row);
  }

  function createSettingsVersion({ clientId, settings, createdByUserId }) {
    const latest = getLatestSettingsVersion(clientId);

    const nextVersion = latest ? latest.version + 1 : 1;
    const record = {
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

  function getLatestPluginArtifact({ clientId, kind }) {
    const row = database
      .prepare(
        `SELECT id, client_id, kind, version, artifact_url, integrity, status, created_by_user_id, created_at
         FROM plugin_artifacts
         WHERE client_id = ? AND kind = ? AND status = 'approved'
         ORDER BY version DESC
         LIMIT 1`,
      )
      .get(clientId, kind);

    return rowToPluginArtifact(row);
  }

  function createPluginArtifact({
    clientId,
    kind,
    artifactUrl,
    integrity,
    createdByUserId,
    status = "approved",
  }) {
    const latest = getLatestPluginArtifact({ clientId, kind });
    const nextVersion = latest ? latest.version + 1 : 1;

    const record = {
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

  function createManifestVersion({ clientId, manifest, signature, keyId }) {
    const latest = database
      .prepare(
        `SELECT version FROM manifest_versions
         WHERE client_id = ?
         ORDER BY version DESC
         LIMIT 1`,
      )
      .get(clientId);

    const nextVersion = latest ? latest.version + 1 : 1;

    const record = {
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

  function createAuditEvent({ clientId = null, userId = null, eventType, payload = null }) {
    const record = {
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

  function seedDemoData() {
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
    findUserByEmail,
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
    createOAuthState,
    consumeOAuthState,
    findOAuthIdentity,
    createOAuthIdentity,
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
