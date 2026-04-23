import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";

export type NodeEnv = "development" | "test" | "production";
export type MembershipRole = "owner" | "editor" | "viewer";
export type PluginKind = "pre" | "post";
export type PluginArtifactStatus = "approved" | "pending" | "rejected";

export interface EnvConfig {
  nodeEnv: NodeEnv;
  port: number;
  host: string;
  dbPath: string;
  sessionTtlHours: number;
  manifestPrivateKeyPath: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  dashboardUrl: string;
  runtimeLoaderUrl: string;
  publicOrigin: string;
  enableMockGoogle: boolean;
  manifestPublicKeyPem: string;
}

export interface UiSettings {
  fontScalePct: number;
  fontWeight: number;
  fontFamily: string;
  fontColor: string;
  spacingEm: number;
}

export type UiSettingsInput = Partial<UiSettings> | Record<string, unknown>;

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  createdAt: number;
}

export interface ClientRecord {
  id: string;
  slug: string;
  name: string;
  preferredCurrency: string;
  allowedOrigins: string[];
  allowedPaths: string[];
  createdAt: number;
}

export interface ClientWithRole extends ClientRecord {
  role: MembershipRole;
}

export interface ClientMembershipRecord {
  clientId: string;
  userId: string;
  role: MembershipRole;
  createdAt: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAt: number;
  createdAt: number;
}

export interface OAuthStateRecord {
  state: string;
  returnTo: string;
  expiresAt: number;
  createdAt: number;
}

export interface OAuthIdentityRecord {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  email: string;
  createdAt: number;
}

export interface SettingsVersionRecord {
  id: string;
  clientId: string;
  version: number;
  settings: UiSettings;
  createdByUserId: string | null;
  createdAt: number;
}

export interface PluginArtifactRecord {
  id: string;
  clientId: string;
  kind: PluginKind;
  version: number;
  artifactUrl: string;
  integrity: string;
  status: PluginArtifactStatus;
  createdByUserId: string | null;
  createdAt: number;
}

export interface ManifestVersionRecord {
  id: string;
  clientId: string;
  version: number;
  manifest: RuntimeManifest;
  signature: string;
  keyId: string;
  createdAt: number;
}

export interface AuditEventRecord {
  id: string;
  clientId: string | null;
  userId: string | null;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: number;
}

export interface ClientAccessRecord {
  client: ClientRecord;
  membership: ClientMembershipRecord;
  canWrite: boolean;
}

export interface SessionValidationResult {
  session: SessionRecord;
  user: UserRecord;
}

export interface GoogleProfile {
  providerUserId: string;
  email: string;
  displayName: string;
}

export interface UpsertGoogleUserResult {
  user: UserRecord;
  created: boolean;
}

export interface RegisterLocalUserResult {
  user: UserRecord;
  client: ClientRecord;
}

export interface RuntimeManifest {
  schemaVersion: number;
  clientId: string;
  allowedOrigins: string[];
  allowedPathRegex: string[];
  preferredCurrency: string;
  parserConfig: {
    extraWords: Record<string, string>;
  };
  plugins: {
    pre: {
      url: string;
      integrity: string;
    };
    post: {
      url: string;
      integrity: string;
    };
  };
  settings: {
    url: string;
  };
  uiDefaults: UiSettings;
  flags: {
    killSwitch: boolean;
  };
  issuedAt: number;
  expiresAt: number;
  kid: string;
}

export interface SignedManifestResult {
  manifest: RuntimeManifest;
  signature: string;
  keyId: string;
  publicKeyPem: string;
  settingsVersion: SettingsVersionRecord;
}

export interface RuntimeSettingsResult {
  version: number;
  settings: UiSettings;
  updatedAt: number;
}

export interface SigningMetadata {
  keyId: string;
  publicKeyPem: string;
}

export interface SigningService {
  signManifest(manifestPayload: RuntimeManifest): {
    signature: string;
    canonicalPayload: string;
    keyId: string;
  };
  getPublicKeyPem(): string;
  getKeyMetadata(): {
    keyId: string;
    publicKeyPem: string;
    privateKeyPath: string;
    publicKeyPath: string | null;
  };
}

export interface DatabaseApi {
  database: DatabaseSync;
  createUser(input: {
    email: string;
    passwordHash: string | null;
    displayName: string;
  }): UserRecord;
  findUserByEmail(email: string): UserRecord | null;
  findUserById(userId: string): UserRecord | null;
  createClient(input: {
    slug: string;
    name: string;
    preferredCurrency: string;
    allowedOrigins: string[];
    allowedPaths: string[];
  }): ClientRecord;
  findClientById(clientId: string): ClientRecord | null;
  findClientBySlug(slug: string): ClientRecord | null;
  listClientsForUser(userId: string): ClientWithRole[];
  addClientMember(input: {
    clientId: string;
    userId: string;
    role: MembershipRole;
  }): void;
  findClientMembership(input: {
    clientId: string;
    userId: string;
  }): ClientMembershipRecord | null;
  createSession(input: {
    userId: string;
    csrfToken: string;
    expiresAt: number;
  }): SessionRecord;
  findSession(sessionId: string): SessionRecord | null;
  deleteSession(sessionId: string): void;
  deleteExpiredSessions(): void;
  createOAuthState(input: {
    returnTo: string;
    expiresAt: number;
  }): OAuthStateRecord;
  consumeOAuthState(state: string): OAuthStateRecord | null;
  findOAuthIdentity(input: {
    provider: string;
    providerUserId: string;
  }): OAuthIdentityRecord | null;
  createOAuthIdentity(input: {
    userId: string;
    provider: string;
    providerUserId: string;
    email: string;
  }): OAuthIdentityRecord;
  getLatestSettingsVersion(clientId: string): SettingsVersionRecord | null;
  createSettingsVersion(input: {
    clientId: string;
    settings: UiSettings;
    createdByUserId: string | null;
  }): SettingsVersionRecord;
  getLatestPluginArtifact(input: {
    clientId: string;
    kind: PluginKind;
  }): PluginArtifactRecord | null;
  createPluginArtifact(input: {
    clientId: string;
    kind: PluginKind;
    artifactUrl: string;
    integrity: string;
    createdByUserId: string | null;
    status?: PluginArtifactStatus;
  }): PluginArtifactRecord;
  createManifestVersion(input: {
    clientId: string;
    manifest: RuntimeManifest;
    signature: string;
    keyId: string;
  }): ManifestVersionRecord;
  createAuditEvent(input: {
    clientId?: string | null;
    userId?: string | null;
    eventType: string;
    payload?: Record<string, unknown> | null;
  }): AuditEventRecord;
  seedDemoData(): ClientRecord;
  runTransaction<T>(callback: () => T): T;
}

export interface AuthService {
  registerLocalUser(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<RegisterLocalUserResult>;
  loginWithPassword(input: {
    email: string;
    password: string;
  }): Promise<UserRecord | null>;
  createSessionForUser(userId: string): SessionRecord;
  validateSession(sessionId: string | null): SessionValidationResult | null;
  logoutSession(sessionId: string): void;
  createGoogleAuthStart(input: {
    returnTo: string;
  }): {
    state: string;
    redirectUrl: string;
  };
  consumeGoogleState(state: string): OAuthStateRecord | null;
  upsertGoogleUser(profile: GoogleProfile): UpsertGoogleUserResult | null;
  getUserClients(userId: string): ClientWithRole[];
  getClientAccess(input: {
    userId: string;
    clientId: string;
  }): ClientAccessRecord | null;
}

export interface RuntimeService {
  getSignedManifestForClient(clientId: string): SignedManifestResult | null;
  getRuntimeSettings(clientId: string): RuntimeSettingsResult | null;
  updateClientSettings(input: {
    clientId: string;
    settings: UiSettingsInput;
    userId: string;
  }): RuntimeSettingsResult;
  publishPluginArtifact(input: {
    clientId: string;
    kind: PluginKind;
    artifactUrl: string;
    integrity: string;
    userId: string;
  }): PluginArtifactRecord;
  getInstallSnippet(input: {
    clientId: string;
  }): string;
  getSigningMetadata(): SigningMetadata;
}

export interface ApiError {
  statusCode: number;
  payload: {
    error: {
      code: string;
      message: string;
      details: Record<string, unknown> | null;
    };
  };
}

export interface RouteResult {
  statusCode: number;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  setCookies?: string[];
}

export interface RouteOptions {
  requiresAuth?: boolean;
  requiresCsrf?: boolean;
}

export interface RouteContext {
  env: EnvConfig;
  request: IncomingMessage;
  response: ServerResponse;
  requestId: string;
  params: Record<string, string>;
  query: URLSearchParams;
  user: UserRecord | null;
  session: SessionRecord | null;
}

export type RouteHandler = (ctx: RouteContext) => RouteResult | Promise<RouteResult>;

export interface CompiledPathPattern {
  regex: RegExp;
  keys: string[];
}

export interface RouteDefinition {
  method: string;
  pathPattern: string;
  compiled: CompiledPathPattern;
  options: RouteOptions;
  handler: RouteHandler;
}

export interface ControlPlaneApp {
  handle(request: IncomingMessage, response: ServerResponse): Promise<void>;
}
