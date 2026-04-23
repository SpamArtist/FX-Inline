import crypto from "node:crypto";
import { createId } from "../utils/ids.js";
import { hoursFromNow, nowMs } from "../utils/time.js";
import type {
  AuthService,
  ClientRecord,
  ClerkAuthService,
  ClerkVerifiedIdentity,
  DatabaseApi,
  EnvConfig,
  MembershipRole,
  UserRecord,
} from "../types.js";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 40);
}

function makeCsrfToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function roleCanWrite(role: MembershipRole): boolean {
  return role === "owner" || role === "editor";
}

function createDefaultPluginArtifacts(database: DatabaseApi, clientId: string, userId: string | null = null): void {
  database.createPluginArtifact({
    clientId,
    kind: "pre",
    artifactUrl: "/b2b/clients/acme/pre.v1.js",
    integrity: "sha256-lu7Y8YbmNXtJXmVFJbtzZgMRjTukAv/Adu+yXIB/qgw=",
    createdByUserId: userId,
    status: "approved",
  });

  database.createPluginArtifact({
    clientId,
    kind: "post",
    artifactUrl: "/b2b/clients/acme/post.v1.js",
    integrity: "sha256-xYRtIxxmKh/DhPVMKEMgwzr4p65nSJvO1V8NPcabXAA=",
    createdByUserId: userId,
    status: "approved",
  });
}

function createWorkspaceClientForUser(
  database: DatabaseApi,
  userId: string,
  normalizedEmail: string,
  displayName: string,
): ClientRecord {
  const candidateSlugBase = slugify(normalizedEmail.split("@")[0] || "client");
  let candidateSlug = candidateSlugBase || `client-${createId("slug").slice(-6)}`;
  let suffix = 1;

  while (database.findClientBySlug(candidateSlug)) {
    candidateSlug = `${candidateSlugBase}-${suffix}`;
    suffix += 1;
  }

  const client = database.createClient({
    slug: candidateSlug,
    name: `${displayName || normalizedEmail} Workspace`,
    preferredCurrency: "USD",
    allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
    allowedPaths: ["^/pricing(?:/|$)", "^/store(?:/|$)", "^/b2b-demo(?:/|$)"],
  });

  database.addClientMember({
    clientId: client.id,
    userId,
    role: "owner",
  });

  database.createSettingsVersion({
    clientId: client.id,
    settings: {
      fontScalePct: 90,
      fontWeight: 600,
      fontFamily: "inherit",
      fontColor: "#355aa8",
      spacingEm: 0.1,
    },
    createdByUserId: userId,
  });

  createDefaultPluginArtifacts(database, client.id, userId);

  return client;
}

function resolveUserFromClerkIdentity(
  database: DatabaseApi,
  identity: ClerkVerifiedIdentity,
): { user: UserRecord; created: boolean } {
  const normalizedEmail = normalizeEmail(identity.email);

  const byClerkId = database.findUserByClerkUserId(identity.clerkUserId);
  if (byClerkId) {
    const needsUpdate =
      byClerkId.email !== normalizedEmail ||
      byClerkId.displayName !== identity.displayName ||
      byClerkId.clerkUserId !== identity.clerkUserId;

    if (!needsUpdate) {
      return { user: byClerkId, created: false };
    }

    return {
      user: database.updateUserIdentity({
        userId: byClerkId.id,
        email: normalizedEmail,
        displayName: identity.displayName,
        clerkUserId: identity.clerkUserId,
      }),
      created: false,
    };
  }

  const byEmail = database.findUserByEmail(normalizedEmail);
  if (byEmail) {
    return {
      user: database.updateUserIdentity({
        userId: byEmail.id,
        email: normalizedEmail,
        displayName: identity.displayName,
        clerkUserId: identity.clerkUserId,
      }),
      created: false,
    };
  }

  const user = database.createUser({
    email: normalizedEmail,
    passwordHash: null,
    clerkUserId: identity.clerkUserId,
    displayName: identity.displayName,
  });

  createWorkspaceClientForUser(database, user.id, normalizedEmail, identity.displayName);

  return {
    user,
    created: true,
  };
}

export function createAuthService({
  database,
  env,
  clerkAuthService,
}: {
  database: DatabaseApi;
  env: EnvConfig;
  clerkAuthService: ClerkAuthService;
}): AuthService {
  function createSessionForUser(userId: string, clerkSessionId: string | null) {
    return database.createSession({
      userId,
      clerkSessionId,
      csrfToken: makeCsrfToken(),
      expiresAt: hoursFromNow(env.sessionTtlHours),
    });
  }

  async function loginWithClerkSession({
    clerkSessionToken,
    clerkUserId,
  }: {
    clerkSessionToken: string;
    clerkUserId?: string | null;
  }) {
    const verifiedIdentity = await clerkAuthService.verifySessionToken({
      clerkSessionToken,
      clerkUserId,
    });

    return database.runTransaction(() => {
      const resolvedUser = resolveUserFromClerkIdentity(database, verifiedIdentity);
      const session = createSessionForUser(
        resolvedUser.user.id,
        verifiedIdentity.clerkSessionId,
      );

      database.createAuditEvent({
        userId: resolvedUser.user.id,
        eventType: "auth.login",
        payload: {
          method: "clerk",
          clerkUserId: verifiedIdentity.clerkUserId,
          clerkSessionId: verifiedIdentity.clerkSessionId,
        },
      });

      return {
        user: resolvedUser.user,
        session,
        created: resolvedUser.created,
      };
    });
  }

  function validateSession(sessionId: string | null) {
    if (!sessionId) return null;

    database.deleteExpiredSessions();

    const session = database.findSession(sessionId);
    if (!session) return null;

    if (session.expiresAt <= nowMs()) {
      database.deleteSession(session.id);
      return null;
    }

    const user = database.findUserById(session.userId);
    if (!user) {
      database.deleteSession(session.id);
      return null;
    }

    return {
      session,
      user,
    };
  }

  function logoutSession(sessionId: string): void {
    database.deleteSession(sessionId);
  }

  function getUserClients(userId: string) {
    return database.listClientsForUser(userId);
  }

  function getClientAccess({ userId, clientId }: { userId: string; clientId: string }) {
    const membership = database.findClientMembership({ userId, clientId });
    if (!membership) {
      return null;
    }

    const client = database.findClientById(clientId);
    if (!client) {
      return null;
    }

    return {
      client,
      membership,
      canWrite: roleCanWrite(membership.role),
    };
  }

  return {
    loginWithClerkSession,
    createSessionForUser,
    validateSession,
    logoutSession,
    getUserClients,
    getClientAccess,
  };
}
