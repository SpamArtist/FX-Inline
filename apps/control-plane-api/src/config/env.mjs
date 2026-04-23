import path from "node:path";

function asString(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function asInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function assertBooleanString(value, key) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${key} must be 'true' or 'false'`);
}

function normalizePemString(value) {
  if (!value) return "";
  return value.replace(/\\n/gu, "\n");
}

export function loadEnv(overrides = {}) {
  const source = {
    ...process.env,
    ...overrides,
  };

  const nodeEnv = asString(source.NODE_ENV, "development");
  const allowedEnvs = new Set(["development", "test", "production"]);

  if (!allowedEnvs.has(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }

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
