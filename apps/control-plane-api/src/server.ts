import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./config/env.js";
import { createDatabase } from "./db/database.js";
import { createAuthService } from "./services/auth.js";
import { createClerkAuthService } from "./services/clerk.js";
import { createRuntimeService } from "./services/runtime.js";
import { createSigningService } from "./services/signing.js";
import { createControlPlaneApp } from "./app.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../../..");

function resolveDatabaseUrl(databaseUrl: string): string {
  if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
    return databaseUrl;
  }

  if (!databaseUrl.startsWith("pglite://")) {
    return databaseUrl;
  }

  const pgliteTarget = databaseUrl.slice("pglite://".length);
  if (!pgliteTarget.length || pgliteTarget === ":memory:") {
    return "pglite://:memory:";
  }

  if (path.isAbsolute(pgliteTarget)) {
    return `pglite://${pgliteTarget}`;
  }

  return `pglite://${path.resolve(repositoryRoot, pgliteTarget)}`;
}

export async function createServerInstance(envOverrides: Record<string, string | undefined> = {}) {
  const env = loadEnv(envOverrides);

  const database = await createDatabase({
    databaseUrl: resolveDatabaseUrl(env.databaseUrl),
  });

  await database.seedDemoData();

  const signingService = createSigningService({
    privateKeyPath: env.manifestPrivateKeyPath,
    fallbackDirectory: path.resolve(repositoryRoot, "apps/control-plane-api/.data"),
  });

  const clerkAuthService = createClerkAuthService(env);

  const authService = createAuthService({
    database,
    env,
    clerkAuthService,
  });

  const runtimeService = createRuntimeService({
    database,
    signingService,
    env,
  });

  const app = createControlPlaneApp({
    env,
    authService,
    runtimeService,
  });

  const server = http.createServer(app.handle);

  return {
    env,
    database,
    app,
    server,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { env, server } = await createServerInstance();

  server.listen(env.port, env.host, () => {
    console.log(`[control-plane-api] listening at http://${env.host}:${env.port}`);
  });
}
