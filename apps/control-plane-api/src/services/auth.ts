import crypto from "node:crypto";
import { createId } from "../utils/ids.js";
import { hoursFromNow, nowMs } from "../utils/time.js";
import { createApiError } from "../utils/http.js";
import type {
  AllowedEmailDomainRecord,
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

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase();
}

function extractDomainFromEmail(email: string): string | null {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex >= email.length - 1) {
    return null;
  }

  return normalizeDomain(email.slice(atIndex + 1));
}

function isValidDomainSyntax(domain: string): boolean {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(domain);
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

async function createDefaultPluginArtifacts(
  database: DatabaseApi,
  clientId: string,
  userId: string | null = null,
): Promise<void> {
  await database.createPluginArtifact({
    clientId,
    kind: "pre",
    artifactUrl: "/b2b/clients/acme/pre.v1.js",
    integrity: "sha256-lu7Y8YbmNXtJXmVFJbtzZgMRjTukAv/Adu+yXIB/qgw=",
    createdByUserId: userId,
    status: "approved",
  });

  await database.createPluginArtifact({
    clientId,
    kind: "post",
    artifactUrl: "/b2b/clients/acme/post.v1.js",
    integrity: "sha256-xYRtIxxmKh/DhPVMKEMgwzr4p65nSJvO1V8NPcabXAA=",
    createdByUserId: userId,
    status: "approved",
  });
}

async function createWorkspaceClientForUser(
  database: DatabaseApi,
  userId: string,
  normalizedEmail: string,
  displayName: string,
): Promise<ClientRecord> {
  const candidateSlugBase = slugify(normalizedEmail.split("@")[0] || "client");
  let candidateSlug = candidateSlugBase || `client-${createId("slug").slice(-6)}`;
  let suffix = 1;

  while (await database.findClientBySlug(candidateSlug)) {
    candidateSlug = `${candidateSlugBase}-${suffix}`;
    suffix += 1;
  }

  const client = await database.createClient({
    slug: candidateSlug,
    name: `${displayName || normalizedEmail} Workspace`,
    preferredCurrency: "USD",
    allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
    allowedPaths: ["^/pricing(?:/|$)", "^/store(?:/|$)", "^/b2b-demo(?:/|$)"],
  });

  await database.addClientMember({
    clientId: client.id,
    userId,
    role: "owner",
  });

  await database.createSettingsVersion({
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

  await createDefaultPluginArtifacts(database, client.id, userId);

  return client;
}

async function resolveUserFromClerkIdentity(
  database: DatabaseApi,
  identity: ClerkVerifiedIdentity,
): Promise<{ user: UserRecord; created: boolean }> {
  const normalizedEmail = normalizeEmail(identity.email);

  const byClerkId = await database.findUserByClerkUserId(identity.clerkUserId);
  if (byClerkId) {
    const needsUpdate =
      byClerkId.email !== normalizedEmail ||
      byClerkId.displayName !== identity.displayName ||
      byClerkId.clerkUserId !== identity.clerkUserId;

    if (!needsUpdate) {
      return { user: byClerkId, created: false };
    }

    return {
      user: await database.updateUserIdentity({
        userId: byClerkId.id,
        email: normalizedEmail,
        displayName: identity.displayName,
        clerkUserId: identity.clerkUserId,
      }),
      created: false,
    };
  }

  const byEmail = await database.findUserByEmail(normalizedEmail);
  if (byEmail) {
    return {
      user: await database.updateUserIdentity({
        userId: byEmail.id,
        email: normalizedEmail,
        displayName: identity.displayName,
        clerkUserId: identity.clerkUserId,
      }),
      created: false,
    };
  }

  const user = await database.createUser({
    email: normalizedEmail,
    clerkUserId: identity.clerkUserId,
    displayName: identity.displayName,
  });

  await createWorkspaceClientForUser(database, user.id, normalizedEmail, identity.displayName);

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
  async function createSessionForDatabase(
    targetDatabase: DatabaseApi,
    userId: string,
    clerkSessionId: string | null,
  ) {
    return targetDatabase.createSession({
      userId,
      clerkSessionId,
      csrfToken: makeCsrfToken(),
      expiresAt: hoursFromNow(env.sessionTtlHours),
    });
  }

  async function createSessionForUser(userId: string, clerkSessionId: string | null) {
    return createSessionForDatabase(database, userId, clerkSessionId);
  }

  async function loginWithClerkSession({
    clerkSessionToken,
    clerkUserId,
  }: {
    clerkSessionToken: string;
    clerkUserId?: string | null;
  }) {
    let verifiedIdentity: ClerkVerifiedIdentity;
    try {
      verifiedIdentity = await clerkAuthService.verifySessionToken({
        clerkSessionToken,
        clerkUserId,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Session token verification failed";
      throw createApiError(
        "AUTH_CLERK_TOKEN_INVALID",
        "Clerk session token is invalid or expired.",
        env.nodeEnv === "production" ? null : { reason },
        401,
      );
    }

    const normalizedEmail = normalizeEmail(verifiedIdentity.email);
    const emailDomain = extractDomainFromEmail(normalizedEmail);
    if (!emailDomain) {
      throw createApiError(
        "AUTH_EMAIL_INVALID",
        "Verified identity does not include a valid email domain",
        null,
        400,
      );
    }

    return database.runTransaction(async (tx) => {
      const isPlatformAdmin = await tx.isPlatformAdminByIdentity({
        email: normalizedEmail,
        clerkUserId: verifiedIdentity.clerkUserId,
      });

      if (!isPlatformAdmin) {
        const allowedDomains = await tx.listAllowedEmailDomains();
        if (!allowedDomains.length) {
          throw createApiError(
            "AUTH_DOMAIN_ALLOWLIST_EMPTY",
            "No client domains are allowed yet. Contact platform admin.",
            null,
            403,
          );
        }

        const isAllowed = allowedDomains.some((entry) => entry.domain === emailDomain);
        if (!isAllowed) {
          throw createApiError(
            "AUTH_DOMAIN_NOT_ALLOWED",
            "Your email domain is not allowed for this dashboard.",
            { domain: emailDomain },
            403,
          );
        }
      }

      const resolvedUser = await resolveUserFromClerkIdentity(tx, verifiedIdentity);
      const session = await createSessionForDatabase(
        tx,
        resolvedUser.user.id,
        verifiedIdentity.clerkSessionId,
      );

      await tx.createAuditEvent({
        userId: resolvedUser.user.id,
        eventType: "auth.login",
        payload: {
          method: "clerk",
          clerkUserId: verifiedIdentity.clerkUserId,
          clerkSessionId: verifiedIdentity.clerkSessionId,
          emailDomain,
          isPlatformAdmin,
        },
      });

      return {
        user: resolvedUser.user,
        session,
        created: resolvedUser.created,
        isPlatformAdmin,
      };
    });
  }

  async function validateSession(sessionId: string | null) {
    if (!sessionId) return null;

    await database.deleteExpiredSessions();

    const session = await database.findSession(sessionId);
    if (!session) return null;

    if (session.expiresAt <= nowMs()) {
      await database.deleteSession(session.id);
      return null;
    }

    const user = await database.findUserById(session.userId);
    if (!user) {
      await database.deleteSession(session.id);
      return null;
    }

    return {
      session,
      user,
    };
  }

  async function logoutSession(sessionId: string): Promise<void> {
    await database.deleteSession(sessionId);
  }

  async function getUserClients(userId: string) {
    return database.listClientsForUser(userId);
  }

  async function isPlatformAdminForUser(user: UserRecord): Promise<boolean> {
    return database.isPlatformAdminByIdentity({
      email: user.email,
      clerkUserId: user.clerkUserId,
    });
  }

  async function listAllowedEmailDomains(): Promise<AllowedEmailDomainRecord[]> {
    return database.listAllowedEmailDomains();
  }

  async function addAllowedEmailDomain({
    domain,
    actorUserId,
  }: {
    domain: string;
    actorUserId: string;
  }): Promise<AllowedEmailDomainRecord> {
    const normalizedDomain = normalizeDomain(domain);
    if (!isValidDomainSyntax(normalizedDomain)) {
      throw createApiError(
        "ADMIN_DOMAIN_INVALID",
        "Domain must be a valid hostname like example.com",
        { domain },
        400,
      );
    }

    return database.runTransaction(async (tx) => {
      const record = await tx.addAllowedEmailDomain({
        domain: normalizedDomain,
        createdByUserId: actorUserId,
      });

      await tx.createAuditEvent({
        userId: actorUserId,
        eventType: "admin.allowed_domain.add",
        payload: {
          domain: record.domain,
        },
      });

      return record;
    });
  }

  async function removeAllowedEmailDomain({
    domain,
    actorUserId,
  }: {
    domain: string;
    actorUserId: string;
  }): Promise<{ removed: boolean; domain: string }> {
    const normalizedDomain = normalizeDomain(domain);
    if (!isValidDomainSyntax(normalizedDomain)) {
      throw createApiError(
        "ADMIN_DOMAIN_INVALID",
        "Domain must be a valid hostname like example.com",
        { domain },
        400,
      );
    }

    return database.runTransaction(async (tx) => {
      const removed = await tx.removeAllowedEmailDomain(normalizedDomain);

      await tx.createAuditEvent({
        userId: actorUserId,
        eventType: "admin.allowed_domain.remove",
        payload: {
          domain: normalizedDomain,
          removed,
        },
      });

      return {
        removed,
        domain: normalizedDomain,
      };
    });
  }

  async function getClientAccess({ userId, clientId }: { userId: string; clientId: string }) {
    const membership = await database.findClientMembership({ userId, clientId });
    if (!membership) {
      return null;
    }

    const client = await database.findClientById(clientId);
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
    isPlatformAdminForUser,
    listAllowedEmailDomains,
    addAllowedEmailDomain,
    removeAllowedEmailDomain,
    getClientAccess,
  };
}
