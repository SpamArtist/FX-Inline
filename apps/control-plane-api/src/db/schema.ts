import { bigint, pgTable, primaryKey, text, unique } from "drizzle-orm/pg-core";

export const schemaMigrationsTable = pgTable("schema_migrations", {
  id: text("id").primaryKey(),
  appliedAt: bigint("applied_at", { mode: "number" }).notNull(),
});

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  clerkUserId: text("clerk_user_id"),
  displayName: text("display_name"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const clientsTable = pgTable("clients", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  preferredCurrency: text("preferred_currency").notNull(),
  allowedOriginsJson: text("allowed_origins_json").notNull(),
  allowedPathsJson: text("allowed_paths_json").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const clientMembersTable = pgTable(
  "client_members",
  {
    clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.clientId, table.userId] }),
  }),
);

export const clientSettingsVersionsTable = pgTable(
  "client_settings_versions",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    version: bigint("version", { mode: "number" }).notNull(),
    settingsJson: text("settings_json").notNull(),
    createdByUserId: text("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    clientVersionUnique: unique().on(table.clientId, table.version),
  }),
);

export const pluginArtifactsTable = pgTable(
  "plugin_artifacts",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    version: bigint("version", { mode: "number" }).notNull(),
    artifactUrl: text("artifact_url").notNull(),
    integrity: text("integrity").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    clientKindVersionUnique: unique().on(table.clientId, table.kind, table.version),
  }),
);

export const manifestVersionsTable = pgTable(
  "manifest_versions",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    version: bigint("version", { mode: "number" }).notNull(),
    manifestJson: text("manifest_json").notNull(),
    signature: text("signature").notNull(),
    keyId: text("key_id").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    clientVersionUnique: unique().on(table.clientId, table.version),
  }),
);

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clerkSessionId: text("clerk_session_id"),
  csrfToken: text("csrf_token").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const auditEventsTable = pgTable("audit_events", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const controlPlaneSchema = {
  schemaMigrationsTable,
  usersTable,
  clientsTable,
  clientMembersTable,
  clientSettingsVersionsTable,
  pluginArtifactsTable,
  manifestVersionsTable,
  sessionsTable,
  auditEventsTable,
};
