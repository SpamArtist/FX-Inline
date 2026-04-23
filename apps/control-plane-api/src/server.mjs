import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./config/env.mjs";
import { createDatabase } from "./db/database.mjs";
import { createAuthService } from "./services/auth.mjs";
import { createRuntimeService } from "./services/runtime.mjs";
import { createSigningService } from "./services/signing.mjs";
import { createControlPlaneApp } from "./app.mjs";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../../..");

function resolveDbPath(dbPath) {
  if (path.isAbsolute(dbPath)) {
    return dbPath;
  }

  return path.resolve(repositoryRoot, dbPath);
}

export function createServerInstance(envOverrides = {}) {
  const env = loadEnv(envOverrides);

  const database = createDatabase({
    dbPath: resolveDbPath(env.dbPath),
  });

  database.seedDemoData();

  const signingService = createSigningService({
    privateKeyPath: env.manifestPrivateKeyPath,
    fallbackDirectory: path.resolve(repositoryRoot, "apps/control-plane-api/.data"),
  });

  const authService = createAuthService({
    database,
    env,
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
  const { env, server } = createServerInstance();

  server.listen(env.port, env.host, () => {
    console.log(`[control-plane-api] listening at http://${env.host}:${env.port}`);
  });
}
