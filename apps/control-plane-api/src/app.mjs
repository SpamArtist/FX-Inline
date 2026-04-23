import crypto from "node:crypto";
import { URL } from "node:url";
import { createCookie, createApiError, parseCookies, sendJson } from "./utils/http.mjs";

const SESSION_COOKIE_NAME = "cp_session";

function createRequestId() {
  return `req_${crypto.randomUUID().replace(/-/gu, "")}`;
}

function compilePathPattern(pattern) {
  const keys = [];
  const regexPattern = pattern.replace(/:[^/]+/gu, (token) => {
    keys.push(token.slice(1));
    return "([^/]+)";
  });

  return {
    regex: new RegExp(`^${regexPattern}$`, "u"),
    keys,
  };
}

function createRouter() {
  const routes = [];

  function register(method, pathPattern, options, handler) {
    const routeOptions = typeof options === "function" ? {} : options;
    const resolvedHandler = typeof options === "function" ? options : handler;

    const compiled = compilePathPattern(pathPattern);

    routes.push({
      method,
      pathPattern,
      compiled,
      options: routeOptions,
      handler: resolvedHandler,
    });
  }

  function match(method, pathname) {
    for (const route of routes) {
      if (route.method !== method) continue;

      const matched = route.compiled.regex.exec(pathname);
      if (!matched) continue;

      const params = {};
      route.compiled.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(matched[index + 1]);
      });

      return {
        route,
        params,
      };
    }

    return null;
  }

  return {
    register,
    match,
  };
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const bodyText = Buffer.concat(chunks).toString("utf8");
  if (!bodyText.trim().length) {
    return {};
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw createApiError("INVALID_JSON", "Request body must be valid JSON", null, 400);
  }
}

function hasWritePermission(role) {
  return role === "owner" || role === "editor";
}

function userPayload(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

export function createControlPlaneApp({ env, authService, runtimeService }) {
  const router = createRouter();

  router.register("GET", "/health", (_ctx) => {
    return {
      statusCode: 200,
      payload: {
        status: "ok",
        service: "control-plane-api",
        timestamp: new Date().toISOString(),
      },
    };
  });

  router.register("GET", "/ready", (_ctx) => {
    return {
      statusCode: 200,
      payload: {
        status: "ready",
        checks: {
          database: true,
        },
      },
    };
  });

  router.register("POST", "/api/v1/auth/register", async (ctx) => {
    const payload = await readJsonBody(ctx.request);

    const { user, client } = await authService.registerLocalUser({
      email: payload.email,
      password: payload.password,
      displayName: payload.displayName,
    });

    const session = authService.createSessionForUser(user.id);

    return {
      statusCode: 201,
      payload: {
        user: userPayload(user),
        client,
      },
      setCookies: [
        createCookie(SESSION_COOKIE_NAME, session.id, {
          secure: env.nodeEnv === "production",
          maxAgeSeconds: env.sessionTtlHours * 60 * 60,
        }),
      ],
    };
  });

  router.register("POST", "/api/v1/auth/login", async (ctx) => {
    const payload = await readJsonBody(ctx.request);
    const user = await authService.loginWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (!user) {
      throw createApiError("AUTH_INVALID_CREDENTIALS", "Invalid email or password", null, 401);
    }

    const session = authService.createSessionForUser(user.id);

    return {
      statusCode: 200,
      payload: {
        user: userPayload(user),
      },
      setCookies: [
        createCookie(SESSION_COOKIE_NAME, session.id, {
          secure: env.nodeEnv === "production",
          maxAgeSeconds: env.sessionTtlHours * 60 * 60,
        }),
      ],
    };
  });

  router.register(
    "POST",
    "/api/v1/auth/logout",
    { requiresAuth: true, requiresCsrf: true },
    async (ctx) => {
    if (ctx.session) {
      authService.logoutSession(ctx.session.id);
    }

    return {
      statusCode: 200,
      payload: {
        success: true,
      },
      setCookies: [
        createCookie(SESSION_COOKIE_NAME, "", {
          secure: env.nodeEnv === "production",
          maxAgeSeconds: 0,
        }),
      ],
    };
    },
  );

  router.register("GET", "/api/v1/auth/me", { requiresAuth: true }, async (ctx) => {
    if (!ctx.user) {
      throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
    }

    const clients = authService.getUserClients(ctx.user.id);

    return {
      statusCode: 200,
      payload: {
        user: userPayload(ctx.user),
        clients,
      },
    };
  });

  router.register("GET", "/api/v1/auth/csrf", { requiresAuth: true }, async (ctx) => {
    if (!ctx.session) {
      throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
    }

    return {
      statusCode: 200,
      payload: {
        csrfToken: ctx.session.csrfToken,
      },
    };
  });

  router.register("GET", "/api/v1/auth/google/start", async (ctx) => {
    const requestUrl = new URL(ctx.request.url, env.publicOrigin);
    const returnTo = requestUrl.searchParams.get("returnTo") || `${env.dashboardUrl}/#/settings`;

    const { redirectUrl } = authService.createGoogleAuthStart({ returnTo });

    return {
      statusCode: 302,
      headers: {
        location: redirectUrl,
      },
      payload: {
        redirectUrl,
      },
    };
  });

  router.register("GET", "/api/v1/auth/google/callback", async (ctx) => {
    const requestUrl = new URL(ctx.request.url, env.publicOrigin);
    const state = requestUrl.searchParams.get("state");
    const error = requestUrl.searchParams.get("error");

    if (error) {
      throw createApiError("OAUTH_ERROR", `Google OAuth failed: ${error}`, null, 400);
    }

    if (!state) {
      throw createApiError("OAUTH_STATE_MISSING", "Missing OAuth state", null, 400);
    }

    const consumedState = authService.consumeGoogleState(state);
    if (!consumedState) {
      throw createApiError("OAUTH_STATE_INVALID", "Invalid or expired OAuth state", null, 400);
    }

    let profile = null;

    if (env.enableMockGoogle) {
      const email =
        requestUrl.searchParams.get("mockEmail") ||
        requestUrl.searchParams.get("email") ||
        "demo-google-user@example.com";

      profile = {
        providerUserId: `mock-google-${email}`,
        email,
        displayName: requestUrl.searchParams.get("name") || email.split("@")[0],
      };
    }

    if (!profile) {
      throw createApiError(
        "OAUTH_NOT_CONFIGURED",
        "Google token exchange is not configured in this environment",
        null,
        501,
      );
    }

    const upserted = authService.upsertGoogleUser(profile);
    if (!upserted?.user) {
      throw createApiError("OAUTH_USER_ERROR", "Failed to resolve Google user", null, 500);
    }

    const session = authService.createSessionForUser(upserted.user.id);

    return {
      statusCode: 302,
      headers: {
        location: consumedState.returnTo,
      },
      payload: {
        redirectTo: consumedState.returnTo,
      },
      setCookies: [
        createCookie(SESSION_COOKIE_NAME, session.id, {
          secure: env.nodeEnv === "production",
          maxAgeSeconds: env.sessionTtlHours * 60 * 60,
        }),
      ],
    };
  });

  router.register("POST", "/api/v1/auth/google/mock", async (ctx) => {
    if (!env.enableMockGoogle) {
      throw createApiError(
        "OAUTH_NOT_CONFIGURED",
        "Mock Google login is disabled in this environment",
        null,
        403,
      );
    }

    const payload = await readJsonBody(ctx.request);
    const email = payload.email || "demo-google-user@example.com";
    const displayName = payload.displayName || email.split("@")[0];

    const upserted = authService.upsertGoogleUser({
      providerUserId: `mock-google-${email}`,
      email,
      displayName,
    });

    if (!upserted?.user) {
      throw createApiError("OAUTH_USER_ERROR", "Failed to resolve Google user", null, 500);
    }

    const session = authService.createSessionForUser(upserted.user.id);

    return {
      statusCode: 200,
      payload: {
        user: userPayload(upserted.user),
        mocked: true,
      },
      setCookies: [
        createCookie(SESSION_COOKIE_NAME, session.id, {
          secure: env.nodeEnv === "production",
          maxAgeSeconds: env.sessionTtlHours * 60 * 60,
        }),
      ],
    };
  });

  router.register("GET", "/api/v1/clients", { requiresAuth: true }, async (ctx) => {
    if (!ctx.user) {
      throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
    }

    return {
      statusCode: 200,
      payload: {
        clients: authService.getUserClients(ctx.user.id),
      },
    };
  });

  router.register(
    "GET",
    "/api/v1/clients/:clientId/settings/current",
    { requiresAuth: true },
    async (ctx) => {
    if (!ctx.user) {
      throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
    }

    const access = authService.getClientAccess({
      userId: ctx.user.id,
      clientId: ctx.params.clientId,
    });

    if (!access) {
      throw createApiError("CLIENT_ACCESS_DENIED", "Client access denied", null, 403);
    }

    const current = runtimeService.getRuntimeSettings(access.client.id);
    if (!current) {
      throw createApiError("SETTINGS_NOT_FOUND", "Client settings not found", null, 404);
    }

    return {
      statusCode: 200,
      payload: {
        client: {
          id: access.client.id,
          name: access.client.name,
          role: access.membership.role,
        },
        ...current,
      },
    };
    },
  );

  router.register(
    "PUT",
    "/api/v1/clients/:clientId/settings",
    { requiresAuth: true, requiresCsrf: true },
    async (ctx) => {
    if (!ctx.user || !ctx.session) {
      throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
    }

    const access = authService.getClientAccess({
      userId: ctx.user.id,
      clientId: ctx.params.clientId,
    });

    if (!access || !hasWritePermission(access.membership.role)) {
      throw createApiError("CLIENT_WRITE_FORBIDDEN", "Write access denied", null, 403);
    }

    const payload = await readJsonBody(ctx.request);

    const updated = runtimeService.updateClientSettings({
      clientId: access.client.id,
      settings: payload,
      userId: ctx.user.id,
    });

    return {
      statusCode: 200,
      payload: updated,
    };
    },
  );

  router.register(
    "POST",
    "/api/v1/clients/:clientId/plugins/publish",
    { requiresAuth: true, requiresCsrf: true },
    async (ctx) => {
    if (!ctx.user || !ctx.session) {
      throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
    }

    const access = authService.getClientAccess({
      userId: ctx.user.id,
      clientId: ctx.params.clientId,
    });

    if (!access || !hasWritePermission(access.membership.role)) {
      throw createApiError("CLIENT_WRITE_FORBIDDEN", "Write access denied", null, 403);
    }

    const payload = await readJsonBody(ctx.request);

    if (typeof payload.artifactUrl !== "string" || typeof payload.integrity !== "string") {
      throw createApiError("INVALID_PLUGIN_PAYLOAD", "artifactUrl and integrity are required", null, 400);
    }

    const artifact = runtimeService.publishPluginArtifact({
      clientId: access.client.id,
      kind: payload.kind,
      artifactUrl: payload.artifactUrl,
      integrity: payload.integrity,
      userId: ctx.user.id,
    });

    return {
      statusCode: 201,
      payload: artifact,
    };
    },
  );

  router.register(
    "GET",
    "/api/v1/clients/:clientId/install-snippet",
    { requiresAuth: true },
    async (ctx) => {
    if (!ctx.user) {
      throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
    }

    const access = authService.getClientAccess({
      userId: ctx.user.id,
      clientId: ctx.params.clientId,
    });

    if (!access) {
      throw createApiError("CLIENT_ACCESS_DENIED", "Client access denied", null, 403);
    }

    return {
      statusCode: 200,
      payload: {
        snippet: runtimeService.getInstallSnippet({ clientId: access.client.id }),
      },
    };
    },
  );

  router.register("GET", "/api/v1/runtime/:clientId/settings", async (ctx) => {
    const current = runtimeService.getRuntimeSettings(ctx.params.clientId);
    if (!current) {
      throw createApiError("SETTINGS_NOT_FOUND", "Runtime settings not found", null, 404);
    }

    return {
      statusCode: 200,
      payload: current,
      headers: {
        "cache-control": "public, max-age=60",
      },
    };
  });

  router.register("GET", "/api/v1/runtime/:clientId/manifest", async (ctx) => {
    const result = runtimeService.getSignedManifestForClient(ctx.params.clientId);
    if (!result) {
      throw createApiError("MANIFEST_NOT_FOUND", "Client runtime manifest not found", null, 404);
    }

    return {
      statusCode: 200,
      payload: {
        manifest: result.manifest,
        signature: result.signature,
      },
      headers: {
        "cache-control": "public, max-age=45",
      },
    };
  });

  router.register("GET", "/api/v1/runtime/public-key", async (_ctx) => {
    const metadata = runtimeService.getSigningMetadata();

    return {
      statusCode: 200,
      payload: metadata,
      headers: {
        "cache-control": "public, max-age=300",
      },
    };
  });

  async function handle(request, response) {
    const requestId = createRequestId();

    try {
      const requestUrl = new URL(request.url, env.publicOrigin);
      const isRuntimePublicRoute = requestUrl.pathname.startsWith("/api/v1/runtime/");
      const corsHeaders = isRuntimePublicRoute
        ? {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,OPTIONS",
          "access-control-allow-headers": "content-type",
          "x-request-id": requestId,
        }
        : {
          "access-control-allow-origin": env.dashboardUrl,
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,x-csrf-token",
          "x-request-id": requestId,
        };

      if (request.method === "OPTIONS") {
        response.writeHead(204, corsHeaders);
        response.end();
        return;
      }

      const matchedRoute = router.match(request.method || "GET", requestUrl.pathname);

      if (!matchedRoute) {
        sendJson(
          response,
          404,
          {
            error: {
              code: "ROUTE_NOT_FOUND",
              message: `Route not found: ${request.method} ${requestUrl.pathname}`,
              details: null,
            },
            requestId,
          },
          corsHeaders,
        );
        return;
      }

      const cookies = parseCookies(request.headers.cookie || "");
      const sessionId = cookies[SESSION_COOKIE_NAME] || null;
      const sessionResult = authService.validateSession(sessionId);

      const context = {
        env,
        request,
        response,
        requestId,
        params: matchedRoute.params,
        query: requestUrl.searchParams,
        user: sessionResult?.user ?? null,
        session: sessionResult?.session ?? null,
      };

      const routeOptions = matchedRoute.route.options;
      const requiresAuth = Boolean(routeOptions.requiresAuth);
      const requiresCsrf = Boolean(routeOptions.requiresCsrf);

      if (requiresAuth && !context.user) {
        throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
      }

      if (requiresCsrf) {
        const incomingToken = request.headers["x-csrf-token"];
        if (!context.session || incomingToken !== context.session.csrfToken) {
          throw createApiError("CSRF_INVALID", "Invalid CSRF token", null, 403);
        }
      }

      const result = await matchedRoute.route.handler(context);

      const headers = {
        ...corsHeaders,
        ...(result.headers || {}),
      };

      if (result.setCookies?.length) {
        headers["set-cookie"] = result.setCookies;
      }

      if (result.statusCode === 302 && result.headers?.location) {
        response.writeHead(302, headers);
        response.end();
        return;
      }

      sendJson(
        response,
        result.statusCode,
        {
          ...result.payload,
          requestId,
        },
        headers,
      );
    } catch (error) {
      const apiError =
        error && typeof error === "object" && "statusCode" in error && "payload" in error
          ? error
          : createApiError(
            "INTERNAL_ERROR",
            error instanceof Error ? error.message : "Unexpected server error",
            null,
            500,
          );

      sendJson(
        response,
        apiError.statusCode,
        {
          ...apiError.payload,
          requestId,
        },
        corsHeaders,
      );
    }
  }

  return {
    handle,
  };
}
