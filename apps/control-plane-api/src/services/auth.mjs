import crypto from "node:crypto";
import { createId } from "../utils/ids.mjs";
import { hashPassword, verifyPassword } from "../utils/password.mjs";
import { hoursFromNow, nowMs } from "../utils/time.mjs";

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 40);
}

function makeCsrfToken() {
  return crypto.randomBytes(24).toString("hex");
}

function roleCanWrite(role) {
  return role === "owner" || role === "editor";
}

function createDefaultPluginArtifacts(database, clientId, userId = null) {
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

export function createAuthService({ database, env }) {
  async function registerLocalUser({ email, password, displayName }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail.includes("@")) {
      throw new Error("Email must be a valid address");
    }

    const existingUser = database.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new Error("An account with this email already exists");
    }

    const passwordHash = await hashPassword(password);

    return database.runTransaction(() => {
      const user = database.createUser({
        email: normalizedEmail,
        passwordHash,
        displayName: typeof displayName === "string" ? displayName.trim() : "",
      });

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
        userId: user.id,
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
        createdByUserId: user.id,
      });
      createDefaultPluginArtifacts(database, client.id, user.id);

      database.createAuditEvent({
        clientId: client.id,
        userId: user.id,
        eventType: "auth.register",
        payload: { method: "password" },
      });

      return {
        user,
        client,
      };
    });
  }

  async function loginWithPassword({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const user = database.findUserByEmail(normalizedEmail);

    if (!user || !user.passwordHash) {
      return null;
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return null;
    }

    database.createAuditEvent({
      userId: user.id,
      eventType: "auth.login",
      payload: { method: "password" },
    });

    return user;
  }

  function createSessionForUser(userId) {
    const session = database.createSession({
      userId,
      csrfToken: makeCsrfToken(),
      expiresAt: hoursFromNow(env.sessionTtlHours),
    });

    return session;
  }

  function validateSession(sessionId) {
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

  function logoutSession(sessionId) {
    if (!sessionId) return;
    database.deleteSession(sessionId);
  }

  function createGoogleAuthStart({ returnTo }) {
    if (!env.googleClientId || !env.googleRedirectUri) {
      throw new Error("Google OAuth is not configured");
    }

    const oauthState = database.createOAuthState({
      returnTo,
      expiresAt: hoursFromNow(1),
    });

    const redirectUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    redirectUrl.searchParams.set("client_id", env.googleClientId);
    redirectUrl.searchParams.set("redirect_uri", env.googleRedirectUri);
    redirectUrl.searchParams.set("response_type", "code");
    redirectUrl.searchParams.set("scope", "openid email profile");
    redirectUrl.searchParams.set("state", oauthState.state);
    redirectUrl.searchParams.set("access_type", "offline");
    redirectUrl.searchParams.set("prompt", "consent");

    return {
      state: oauthState.state,
      redirectUrl: redirectUrl.toString(),
    };
  }

  function consumeGoogleState(state) {
    const record = database.consumeOAuthState(state);
    if (!record) return null;

    if (record.expiresAt <= nowMs()) {
      return null;
    }

    return record;
  }

  function upsertGoogleUser({ providerUserId, email, displayName }) {
    const existingIdentity = database.findOAuthIdentity({
      provider: "google",
      providerUserId,
    });

    if (existingIdentity) {
      const user = database.findUserById(existingIdentity.userId);
      if (!user) return null;

      return {
        user,
        created: false,
      };
    }

    const normalizedEmail = normalizeEmail(email);

    return database.runTransaction(() => {
      let user = database.findUserByEmail(normalizedEmail);

      if (!user) {
        user = database.createUser({
          email: normalizedEmail,
          passwordHash: null,
          displayName,
        });

        const slug = `${slugify(normalizedEmail.split("@")[0] || "google-user")}-${user.id.slice(-5)}`;
        const client = database.createClient({
          slug,
          name: `${displayName || normalizedEmail} Workspace`,
          preferredCurrency: "USD",
          allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
          allowedPaths: ["^/pricing(?:/|$)", "^/store(?:/|$)", "^/b2b-demo(?:/|$)"],
        });

        database.addClientMember({
          clientId: client.id,
          userId: user.id,
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
          createdByUserId: user.id,
        });
        createDefaultPluginArtifacts(database, client.id, user.id);
      }

      database.createOAuthIdentity({
        userId: user.id,
        provider: "google",
        providerUserId,
        email: normalizedEmail,
      });

      database.createAuditEvent({
        userId: user.id,
        eventType: "auth.login",
        payload: { method: "google" },
      });

      return {
        user,
        created: true,
      };
    });
  }

  function getUserClients(userId) {
    return database.listClientsForUser(userId);
  }

  function getClientAccess({ userId, clientId }) {
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
    registerLocalUser,
    loginWithPassword,
    createSessionForUser,
    validateSession,
    logoutSession,
    createGoogleAuthStart,
    consumeGoogleState,
    upsertGoogleUser,
    getUserClients,
    getClientAccess,
  };
}
