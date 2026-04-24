import type { IncomingMessage, ServerResponse } from "node:http";

export type NodeEnv = "development" | "test" | "production";
export type MembershipRole = "owner" | "editor" | "viewer";
export type PluginKind = "pre" | "post";
export type PluginArtifactStatus = "approved" | "pending" | "rejected";

export interface EnvConfig {
  nodeEnv: NodeEnv;
  port: number;
  host: string;
  databaseUrl: string;
  sessionTtlHours: number;
  manifestPrivateKeyPath: string;
  dashboardUrl: string;
  runtimeLoaderUrl: string;
  publicOrigin: string;
  manifestPublicKeyPem: string;
  clerkSecretKey: string;
  clerkPublishableKey: string;
  clerkApiUrl: string;
  clerkJwksUrl: string;
  clerkJwtPublicKey: string;
  clerkAuthorizedParties: string[];
  enableMockClerk: boolean;
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
  clerkUserId: string | null;
  displayName: string;
  createdAt: number;
}

export interface AllowedEmailDomainRecord {
  domain: string;
  createdByUserId: string | null;
  createdAt: number;
}

export interface PlatformAdminIdentityRecord {
  email: string;
  clerkUserId: string | null;
  createdByUserId: string | null;
  createdAt: number;
  updatedAt: number;
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
  clerkSessionId: string | null;
  csrfToken: string;
  expiresAt: number;
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

export interface ClerkVerifiedIdentity {
  clerkUserId: string;
  clerkSessionId: string;
  email: string;
  displayName: string;
}

export interface ClerkAuthService {
  verifySessionToken(input: {
    clerkSessionToken: string;
    clerkUserId?: string | null;
  }): Promise<ClerkVerifiedIdentity>;
}

export interface DatabaseApi {
  close(): Promise<void>;
  createUser(input: {
    email: string;
    clerkUserId: string | null;
    displayName: string;
  }): Promise<UserRecord>;
  updateUserIdentity(input: {
    userId: string;
    email: string;
    displayName: string;
    clerkUserId: string;
  }): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserByClerkUserId(clerkUserId: string): Promise<UserRecord | null>;
  findUserById(userId: string): Promise<UserRecord | null>;
  upsertPlatformAdminIdentity(input: {
    email: string;
    clerkUserId: string | null;
    createdByUserId: string | null;
  }): Promise<PlatformAdminIdentityRecord>;
  isPlatformAdminByIdentity(input: {
    email: string;
    clerkUserId?: string | null;
  }): Promise<boolean>;
  listAllowedEmailDomains(): Promise<AllowedEmailDomainRecord[]>;
  addAllowedEmailDomain(input: {
    domain: string;
    createdByUserId: string | null;
  }): Promise<AllowedEmailDomainRecord>;
  removeAllowedEmailDomain(domain: string): Promise<boolean>;
  createClient(input: {
    slug: string;
    name: string;
    preferredCurrency: string;
    allowedOrigins: string[];
    allowedPaths: string[];
  }): Promise<ClientRecord>;
  findClientById(clientId: string): Promise<ClientRecord | null>;
  findClientBySlug(slug: string): Promise<ClientRecord | null>;
  listClientsForUser(userId: string): Promise<ClientWithRole[]>;
  addClientMember(input: {
    clientId: string;
    userId: string;
    role: MembershipRole;
  }): Promise<void>;
  findClientMembership(input: {
    clientId: string;
    userId: string;
  }): Promise<ClientMembershipRecord | null>;
  createSession(input: {
    userId: string;
    clerkSessionId: string | null;
    csrfToken: string;
    expiresAt: number;
  }): Promise<SessionRecord>;
  findSession(sessionId: string): Promise<SessionRecord | null>;
  deleteSession(sessionId: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  getLatestSettingsVersion(clientId: string): Promise<SettingsVersionRecord | null>;
  createSettingsVersion(input: {
    clientId: string;
    settings: UiSettings;
    createdByUserId: string | null;
  }): Promise<SettingsVersionRecord>;
  getLatestPluginArtifact(input: {
    clientId: string;
    kind: PluginKind;
  }): Promise<PluginArtifactRecord | null>;
  createPluginArtifact(input: {
    clientId: string;
    kind: PluginKind;
    artifactUrl: string;
    integrity: string;
    createdByUserId: string | null;
    status?: PluginArtifactStatus;
  }): Promise<PluginArtifactRecord>;
  createManifestVersion(input: {
    clientId: string;
    manifest: RuntimeManifest;
    signature: string;
    keyId: string;
  }): Promise<ManifestVersionRecord>;
  createAuditEvent(input: {
    clientId?: string | null;
    userId?: string | null;
    eventType: string;
    payload?: Record<string, unknown> | null;
  }): Promise<AuditEventRecord>;
  runTransaction<T>(callback: (tx: DatabaseApi) => Promise<T>): Promise<T>;
}

export interface AuthService {
  loginWithClerkSession(input: {
    clerkSessionToken: string;
    clerkUserId?: string | null;
  }): Promise<{
    user: UserRecord;
    session: SessionRecord;
    created: boolean;
    isPlatformAdmin: boolean;
  }>;
  isPlatformAdminForUser(user: UserRecord): Promise<boolean>;
  listAllowedEmailDomains(): Promise<AllowedEmailDomainRecord[]>;
  addAllowedEmailDomain(input: {
    domain: string;
    actorUserId: string;
  }): Promise<AllowedEmailDomainRecord>;
  removeAllowedEmailDomain(input: {
    domain: string;
    actorUserId: string;
  }): Promise<{
    removed: boolean;
    domain: string;
  }>;
  createSessionForUser(userId: string, clerkSessionId: string | null): Promise<SessionRecord>;
  validateSession(sessionId: string | null): Promise<SessionValidationResult | null>;
  logoutSession(sessionId: string): Promise<void>;
  getUserClients(userId: string): Promise<ClientWithRole[]>;
  getClientAccess(input: {
    userId: string;
    clientId: string;
  }): Promise<ClientAccessRecord | null>;
}

export interface RuntimeService {
  getSignedManifestForClient(clientId: string): Promise<SignedManifestResult | null>;
  getRuntimeSettings(clientId: string): Promise<RuntimeSettingsResult | null>;
  updateClientSettings(input: {
    clientId: string;
    settings: UiSettingsInput;
    userId: string;
  }): Promise<RuntimeSettingsResult>;
  publishPluginArtifact(input: {
    clientId: string;
    kind: PluginKind;
    artifactUrl: string;
    integrity: string;
    userId: string;
  }): Promise<PluginArtifactRecord>;
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
