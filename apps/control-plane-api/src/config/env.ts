import path from "node:path";
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

  const dbPath = asString(
    source.CONTROL_PLANE_DB_PATH,
    path.resolve(process.cwd(), "apps/control-plane-api/.data/control-plane.db"),
  );

  const sessionTtlHours = asInteger(source.CONTROL_PLANE_SESSION_TTL_HOURS, 24);
  if (!Number.isFinite(sessionTtlHours) || sessionTtlHours < 1 || sessionTtlHours > 168) {
    throw new Error("CONTROL_PLANE_SESSION_TTL_HOURS must be between 1 and 168");
  }

  const enableMockGoogle = assertBooleanString(
    asString(source.CONTROL_PLANE_ENABLE_MOCK_GOOGLE, "true"),
    "CONTROL_PLANE_ENABLE_MOCK_GOOGLE",
  );

  const publicOrigin = asString(
    source.CONTROL_PLANE_PUBLIC_ORIGIN,
    `http://${host}:${port}`,
  );

  return {
    nodeEnv,
    port,
    host,
    dbPath,
    sessionTtlHours,
    manifestPrivateKeyPath: asString(source.CONTROL_PLANE_MANIFEST_PRIVATE_KEY_PATH, ""),
    googleClientId: asString(source.CONTROL_PLANE_GOOGLE_CLIENT_ID, ""),
    googleClientSecret: asString(source.CONTROL_PLANE_GOOGLE_CLIENT_SECRET, ""),
    googleRedirectUri: asString(source.CONTROL_PLANE_GOOGLE_REDIRECT_URI, ""),
    dashboardUrl: asString(source.CONTROL_PLANE_DASHBOARD_URL, "http://127.0.0.1:5174"),
    runtimeLoaderUrl: asString(
      source.CONTROL_PLANE_RUNTIME_LOADER_URL,
      "http://127.0.0.1:5173/b2b/loader.v1.js",
    ),
    publicOrigin,
    enableMockGoogle,
    manifestPublicKeyPem: normalizePemString(
      asString(source.CONTROL_PLANE_MANIFEST_PUBLIC_KEY_PEM, ""),
    ),
  };
}
