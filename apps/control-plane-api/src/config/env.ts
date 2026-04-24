import type { EnvConfig, NodeEnv } from "../types.js";

function asString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function asInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function assertBooleanString(value: string, key: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${key} must be 'true' or 'false'`);
}

function normalizePemString(value: string): string {
  if (!value) return "";
  return value.replace(/\\n/gu, "\n");
}

function asNodeEnv(value: string): NodeEnv {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  throw new Error("NODE_ENV must be development, test, or production");
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function originFromUrl(urlValue: string): string {
  try {
    return new URL(urlValue).origin;
  } catch {
    return urlValue;
  }
}

export function loadEnv(overrides: Record<string, string | undefined> = {}): EnvConfig {
  const source: Record<string, string | undefined> = {
    ...(process.env as Record<string, string | undefined>),
    ...overrides,
  };

  const nodeEnv = asNodeEnv(asString(source.NODE_ENV, "development"));

  const port = asInteger(source.CONTROL_PLANE_PORT, 8787);
  if (!Number.isFinite(port) || port < 0 || port > 65535) {
    throw new Error("CONTROL_PLANE_PORT must be a valid TCP port");
  }

  const host = asString(source.CONTROL_PLANE_HOST, "127.0.0.1");
  if (!host.length) {
    throw new Error("CONTROL_PLANE_HOST is required");
  }

  const databaseUrl = asString(
    source.CONTROL_PLANE_DATABASE_URL,
    "postgres://postgres:postgres@127.0.0.1:5432/fx_inline_control_plane",
  );
  if (
    !databaseUrl.startsWith("postgres://") &&
    !databaseUrl.startsWith("postgresql://") &&
    !databaseUrl.startsWith("pglite://")
  ) {
    throw new Error("CONTROL_PLANE_DATABASE_URL must start with postgres://, postgresql://, or pglite://");
  }

  const sessionTtlHours = asInteger(source.CONTROL_PLANE_SESSION_TTL_HOURS, 24);
  if (!Number.isFinite(sessionTtlHours) || sessionTtlHours < 1 || sessionTtlHours > 168) {
    throw new Error("CONTROL_PLANE_SESSION_TTL_HOURS must be between 1 and 168");
  }

  const publicOrigin = asString(
    source.CONTROL_PLANE_PUBLIC_ORIGIN,
    `http://${host}:${port}`,
  );

  const dashboardUrl = asString(source.CONTROL_PLANE_DASHBOARD_URL, "http://127.0.0.1:5174");

  const enableMockClerk = assertBooleanString(
    asString(
      source.CONTROL_PLANE_ENABLE_MOCK_CLERK,
      nodeEnv === "test" ? "true" : "false",
    ),
    "CONTROL_PLANE_ENABLE_MOCK_CLERK",
  );

  if (nodeEnv === "production" && enableMockClerk) {
    throw new Error("CONTROL_PLANE_ENABLE_MOCK_CLERK must be false in production");
  }

  const clerkSecretKey = asString(source.CONTROL_PLANE_CLERK_SECRET_KEY, "");
  const clerkPublishableKey = asString(source.CONTROL_PLANE_CLERK_PUBLISHABLE_KEY, "");
  const clerkApiUrl = asString(source.CONTROL_PLANE_CLERK_API_URL, "https://api.clerk.com");
  const clerkJwksUrl = asString(source.CONTROL_PLANE_CLERK_JWKS_URL, "https://api.clerk.com/v1/jwks");
  const clerkJwtPublicKey = normalizePemString(
    asString(source.CONTROL_PLANE_CLERK_JWT_PUBLIC_KEY, ""),
  );

  const clerkAuthorizedPartiesRaw = asString(
    source.CONTROL_PLANE_CLERK_AUTHORIZED_PARTIES,
    originFromUrl(dashboardUrl),
  );
  const clerkAuthorizedParties = parseCsv(clerkAuthorizedPartiesRaw);

  if (!enableMockClerk) {
    if (!clerkSecretKey.length) {
      throw new Error("CONTROL_PLANE_CLERK_SECRET_KEY is required when mock Clerk auth is disabled");
    }

    if (!clerkJwtPublicKey.length && !clerkJwksUrl.length) {
      throw new Error("CONTROL_PLANE_CLERK_JWT_PUBLIC_KEY or CONTROL_PLANE_CLERK_JWKS_URL is required");
    }

    if (!clerkAuthorizedParties.length) {
      throw new Error("CONTROL_PLANE_CLERK_AUTHORIZED_PARTIES must contain at least one origin");
    }
  }

  return {
    nodeEnv,
    port,
    host,
    databaseUrl,
    sessionTtlHours,
    manifestPrivateKeyPath: asString(source.CONTROL_PLANE_MANIFEST_PRIVATE_KEY_PATH, ""),
    dashboardUrl,
    runtimeLoaderUrl: asString(
      source.CONTROL_PLANE_RUNTIME_LOADER_URL,
      "http://127.0.0.1:5173/b2b/loader.v1.js",
    ),
    publicOrigin,
    manifestPublicKeyPem: normalizePemString(
      asString(source.CONTROL_PLANE_MANIFEST_PUBLIC_KEY_PEM, ""),
    ),
    clerkSecretKey,
    clerkPublishableKey,
    clerkApiUrl,
    clerkJwksUrl,
    clerkJwtPublicKey,
    clerkAuthorizedParties,
    enableMockClerk,
  };
}
