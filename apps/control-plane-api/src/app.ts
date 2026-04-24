import crypto from "node:crypto";
import { URL } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createCookie, createApiError, parseCookies, sendJson } from "./utils/http.js";
import type {
  ApiError,
  AuthService,
  ControlPlaneApp,
  EnvConfig,
  PluginKind,
  RouteContext,
  RouteDefinition,
  RouteHandler,
  RouteOptions,
  RouteResult,
  RuntimeService,
  UserRecord,
} from "./types.js";

const SESSION_COOKIE_NAME = "cp_session";

function createRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/gu, "")}`;
}

function compilePathPattern(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
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
  const routes: RouteDefinition[] = [];

  function register(
    method: string,
    pathPattern: string,
    options: RouteOptions | RouteHandler,
    handler?: RouteHandler,
  ): void {
    const routeOptions = typeof options === "function" ? {} : options;
    const resolvedHandler = (typeof options === "function" ? options : handler) as RouteHandler;

    const compiled = compilePathPattern(pathPattern);

    routes.push({
      method,
      pathPattern,
      compiled,
      options: routeOptions,
      handler: resolvedHandler,
    });
  }

  function match(method: string, pathname: string): { route: RouteDefinition; params: Record<string, string> } | null {
    for (const route of routes) {
      if (route.method !== method) continue;

      const matched = route.compiled.regex.exec(pathname);
      if (!matched) continue;

      const params: Record<string, string> = {};
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

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

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
    return JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw createApiError("INVALID_JSON", "Request body must be valid JSON", null, 400);
  }
}

function hasWritePermission(role: string): boolean {
  return role === "owner" || role === "editor";
}

function userPayload(user: UserRecord): Record<string, string> {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toOptionalStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value : null;
}

function asApiError(error: unknown): ApiError {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    "payload" in error
  ) {
    return error as ApiError;
  }

  return createApiError(
    "INTERNAL_ERROR",
    error instanceof Error ? error.message : "Unexpected server error",
    null,
    500,
  );
}

export function createControlPlaneApp({
  env,
  authService,
  runtimeService,
}: {
  env: EnvConfig;
  authService: AuthService;
  runtimeService: RuntimeService;
}): ControlPlaneApp {
  const router = createRouter();

  async function assertPlatformAdmin(ctx: RouteContext): Promise<UserRecord> {
    if (!ctx.user) {
      throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
    }

    const isPlatformAdmin = await authService.isPlatformAdminForUser(ctx.user);
    if (!isPlatformAdmin) {
      throw createApiError("AUTH_ADMIN_FORBIDDEN", "Platform admin access required", null, 403);
    }

    return ctx.user;
  }

  router.register("GET", "/health", () => {
    return {
      statusCode: 200,
      payload: {
        status: "ok",
        service: "control-plane-api",
        timestamp: new Date().toISOString(),
      },
    };
  });

  router.register("GET", "/ready", () => {
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

  router.register("POST", "/api/v1/auth/login", async (ctx) => {
    const payload = await readJsonBody(ctx.request);
    const clerkSessionToken = toStringValue(payload.clerkSessionToken);
    const clerkUserId = toOptionalStringValue(payload.clerkUserId);

    if (!clerkSessionToken.length) {
      throw createApiError(
        "AUTH_CLERK_TOKEN_MISSING",
        "clerkSessionToken is required",
        { field: "clerkSessionToken" },
        400,
      );
    }

    const login = await authService.loginWithClerkSession({
      clerkSessionToken,
      clerkUserId,
    });

    return {
      statusCode: 200,
      payload: {
        user: {
          ...userPayload(login.user),
          clerkUserId: login.user.clerkUserId,
          isPlatformAdmin: login.isPlatformAdmin,
        },
        created: login.created,
      },
      setCookies: [
        createCookie(SESSION_COOKIE_NAME, login.session.id, {
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
        await authService.logoutSession(ctx.session.id);
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

    const clients = await authService.getUserClients(ctx.user.id);
    const isPlatformAdmin = await authService.isPlatformAdminForUser(ctx.user);

    return {
      statusCode: 200,
      payload: {
        user: {
          ...userPayload(ctx.user),
          clerkUserId: ctx.user.clerkUserId,
          isPlatformAdmin,
        },
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

  router.register("GET", "/api/v1/auth/clerk/config", async () => {
    return {
      statusCode: 200,
      payload: {
        publishableKey: env.clerkPublishableKey,
        authorizedParties: env.clerkAuthorizedParties,
        mockEnabled: env.enableMockClerk,
      },
      headers: {
        "cache-control": "no-store",
      },
    };
  });

  router.register(
    "GET",
    "/api/v1/admin/allowed-domains",
    { requiresAuth: true },
    async (ctx) => {
      await assertPlatformAdmin(ctx);

      const domains = await authService.listAllowedEmailDomains();
      return {
        statusCode: 200,
        payload: {
          domains,
        },
      };
    },
  );

  router.register(
    "POST",
    "/api/v1/admin/allowed-domains",
    { requiresAuth: true, requiresCsrf: true },
    async (ctx) => {
      const adminUser = await assertPlatformAdmin(ctx);
      const payload = await readJsonBody(ctx.request);
      const domain = toStringValue(payload.domain);

      if (!domain.length) {
        throw createApiError(
          "ADMIN_DOMAIN_MISSING",
          "domain is required",
          { field: "domain" },
          400,
        );
      }

      const record = await authService.addAllowedEmailDomain({
        domain,
        actorUserId: adminUser.id,
      });

      return {
        statusCode: 201,
        payload: {
          domain: record,
        },
      };
    },
  );

  router.register(
    "DELETE",
    "/api/v1/admin/allowed-domains/:domain",
    { requiresAuth: true, requiresCsrf: true },
    async (ctx) => {
      const adminUser = await assertPlatformAdmin(ctx);
      const result = await authService.removeAllowedEmailDomain({
        domain: ctx.params.domain,
        actorUserId: adminUser.id,
      });

      return {
        statusCode: 200,
        payload: {
          ...result,
        },
      };
    },
  );

  router.register("GET", "/api/v1/clients", { requiresAuth: true }, async (ctx) => {
    if (!ctx.user) {
      throw createApiError("AUTH_REQUIRED", "Authentication required", null, 401);
    }

    return {
      statusCode: 200,
      payload: {
        clients: await authService.getUserClients(ctx.user.id),
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

      const access = await authService.getClientAccess({
        userId: ctx.user.id,
        clientId: ctx.params.clientId,
      });

      if (!access) {
        throw createApiError("CLIENT_ACCESS_DENIED", "Client access denied", null, 403);
      }

      const current = await runtimeService.getRuntimeSettings(access.client.id);
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

      const access = await authService.getClientAccess({
        userId: ctx.user.id,
        clientId: ctx.params.clientId,
      });

      if (!access || !hasWritePermission(access.membership.role)) {
        throw createApiError("CLIENT_WRITE_FORBIDDEN", "Write access denied", null, 403);
      }

      const payload = await readJsonBody(ctx.request);

      const updated = await runtimeService.updateClientSettings({
        clientId: access.client.id,
        settings: payload,
        userId: ctx.user.id,
      });

      return {
        statusCode: 200,
        payload: {
          ...updated,
        },
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

      const access = await authService.getClientAccess({
        userId: ctx.user.id,
        clientId: ctx.params.clientId,
      });

      if (!access || !hasWritePermission(access.membership.role)) {
        throw createApiError("CLIENT_WRITE_FORBIDDEN", "Write access denied", null, 403);
      }

      const payload = await readJsonBody(ctx.request);
      const artifactUrl = toOptionalStringValue(payload.artifactUrl);
      const integrity = toOptionalStringValue(payload.integrity);
      const kindValue = toStringValue(payload.kind);

      if (!artifactUrl || !integrity) {
        throw createApiError("INVALID_PLUGIN_PAYLOAD", "artifactUrl and integrity are required", null, 400);
      }

      if (kindValue !== "pre" && kindValue !== "post") {
        throw createApiError("INVALID_PLUGIN_PAYLOAD", "kind must be pre or post", null, 400);
      }

      const artifact = await runtimeService.publishPluginArtifact({
        clientId: access.client.id,
        kind: kindValue as PluginKind,
        artifactUrl,
        integrity,
        userId: ctx.user.id,
      });

      return {
        statusCode: 201,
        payload: {
          ...artifact,
        },
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

      const access = await authService.getClientAccess({
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
    const current = await runtimeService.getRuntimeSettings(ctx.params.clientId);
    if (!current) {
      throw createApiError("SETTINGS_NOT_FOUND", "Runtime settings not found", null, 404);
    }

    return {
      statusCode: 200,
      payload: {
        ...current,
      },
      headers: {
        "cache-control": "public, max-age=60",
      },
    };
  });

  router.register("GET", "/api/v1/runtime/:clientId/manifest", async (ctx) => {
    const result = await runtimeService.getSignedManifestForClient(ctx.params.clientId);
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

  router.register("GET", "/api/v1/runtime/public-key", async () => {
    const metadata = runtimeService.getSigningMetadata();

    return {
      statusCode: 200,
      payload: {
        ...metadata,
      },
      headers: {
        "cache-control": "public, max-age=300",
      },
    };
  });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestId = createRequestId();
    const requestUrl = new URL(request.url || "/", env.publicOrigin);
    const isRuntimePublicRoute = requestUrl.pathname.startsWith("/api/v1/runtime/");
    const corsHeaders: Record<string, string | string[]> = isRuntimePublicRoute
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

    try {
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

      const cookies = parseCookies(typeof request.headers.cookie === "string" ? request.headers.cookie : "");
      const sessionId = cookies[SESSION_COOKIE_NAME] || null;
      const sessionResult = await authService.validateSession(sessionId);

      const context: RouteContext = {
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
        const csrfToken = Array.isArray(incomingToken) ? incomingToken[0] : incomingToken;
        if (!context.session || csrfToken !== context.session.csrfToken) {
          throw createApiError("CSRF_INVALID", "Invalid CSRF token", null, 403);
        }
      }

      const result: RouteResult = await matchedRoute.route.handler(context);

      const headers: Record<string, string | string[]> = {
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
      const apiError = asApiError(error);

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
