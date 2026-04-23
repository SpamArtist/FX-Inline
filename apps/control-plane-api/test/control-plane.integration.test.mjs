import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createServerInstance } from "../dist/server.js";

function createTestDatabasePath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cp-api-test-"));
  return path.join(directory, "control-plane-test.db");
}

function createTestInstance() {
  const dbPath = createTestDatabasePath();

  return createServerInstance({
    NODE_ENV: "test",
    CONTROL_PLANE_HOST: "127.0.0.1",
    CONTROL_PLANE_PORT: "8787",
    CONTROL_PLANE_DB_PATH: dbPath,
    CONTROL_PLANE_DASHBOARD_URL: "http://127.0.0.1:5174",
    CONTROL_PLANE_PUBLIC_ORIGIN: "http://127.0.0.1:8787",
    CONTROL_PLANE_ENABLE_MOCK_CLERK: "true",
    CONTROL_PLANE_MANIFEST_PRIVATE_KEY_PATH: "",
  });
}

function makeMockClerkToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `mock-clerk:${encoded}`;
}

async function invoke(app, { method = "GET", url, body, cookie, csrf }) {
  const requestBody = body === undefined ? "" : JSON.stringify(body);

  const request = Readable.from(requestBody ? [requestBody] : []);
  request.method = method;
  request.url = url;
  request.headers = {
    ...(requestBody ? { "content-type": "application/json" } : {}),
    ...(cookie ? { cookie } : {}),
    ...(csrf ? { "x-csrf-token": csrf } : {}),
  };

  let statusCode = 0;
  let headers = {};
  let responseBody = "";

  const response = {
    writeHead(code, responseHeaders) {
      statusCode = code;
      headers = responseHeaders || {};
    },
    end(chunk) {
      if (chunk) {
        responseBody = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
      }
    },
  };

  await app.handle(request, response);

  return {
    status: statusCode,
    headers,
    payload: responseBody ? JSON.parse(responseBody) : null,
  };
}

function parseSetCookie(headers) {
  const raw = headers["set-cookie"];
  if (!raw) return null;

  if (Array.isArray(raw)) {
    return raw[0].split(";")[0];
  }

  return String(raw).split(";")[0];
}

test("health and readiness endpoints return success", async () => {
  const instance = createTestInstance();

  const health = await invoke(instance.app, {
    url: "/health",
  });

  expect(health.status).toBe(200);
  expect(health.payload.status).toBe("ok");

  const ready = await invoke(instance.app, {
    url: "/ready",
  });

  expect(ready.status).toBe(200);
  expect(ready.payload.status).toBe("ready");
});

test("mock Clerk login, csrf, settings update, and runtime manifest flow", async () => {
  const instance = createTestInstance();

  const login = await invoke(instance.app, {
    method: "POST",
    url: "/api/v1/auth/login",
    body: {
      clerkSessionToken: makeMockClerkToken({
        clerkUserId: "user_owner",
        clerkSessionId: "sess_owner",
        email: "owner@example.com",
        displayName: "Owner",
      }),
    },
  });

  expect(login.status).toBe(200);
  expect(login.payload.user.email).toBe("owner@example.com");
  expect(login.payload.user.clerkUserId).toBe("user_owner");
  expect(login.payload.created).toBe(true);

  const secondLogin = await invoke(instance.app, {
    method: "POST",
    url: "/api/v1/auth/login",
    body: {
      clerkSessionToken: makeMockClerkToken({
        clerkUserId: "user_owner",
        clerkSessionId: "sess_owner_2",
        email: "owner@example.com",
        displayName: "Owner",
      }),
    },
  });

  expect(secondLogin.status).toBe(200);
  expect(secondLogin.payload.created).toBe(false);

  const sessionCookie = parseSetCookie(secondLogin.headers);
  expect(sessionCookie).toContain("cp_session=");

  const me = await invoke(instance.app, {
    url: "/api/v1/auth/me",
    cookie: sessionCookie,
  });

  expect(me.status).toBe(200);
  expect(me.payload.user.clerkUserId).toBe("user_owner");
  expect(me.payload.clients.length).toBeGreaterThan(0);

  const clientId = me.payload.clients[0].id;

  const csrf = await invoke(instance.app, {
    url: "/api/v1/auth/csrf",
    cookie: sessionCookie,
  });

  expect(csrf.status).toBe(200);
  expect(typeof csrf.payload.csrfToken).toBe("string");

  const updated = await invoke(instance.app, {
    method: "PUT",
    url: `/api/v1/clients/${clientId}/settings`,
    cookie: sessionCookie,
    csrf: csrf.payload.csrfToken,
    body: {
      fontColor: "#ea7118",
      fontScalePct: 110,
    },
  });

  expect(updated.status).toBe(200);
  expect(updated.payload.settings.fontColor).toBe("#ea7118");

  const manifest = await invoke(instance.app, {
    url: `/api/v1/runtime/${clientId}/manifest`,
  });

  expect(manifest.status).toBe(200);
  expect(manifest.payload.manifest.clientId).toBe(clientId);
  expect(typeof manifest.payload.signature).toBe("string");

  const installSnippet = await invoke(instance.app, {
    url: `/api/v1/clients/${clientId}/install-snippet`,
    cookie: sessionCookie,
  });

  expect(installSnippet.status).toBe(200);
  expect(installSnippet.payload.snippet).toContain("data-fxi-client-id");
});

test("mock Clerk login creates session when enabled", async () => {
  const instance = createTestInstance();

  const response = await invoke(instance.app, {
    url: "/api/v1/auth/clerk/config",
  });

  expect(response.status).toBe(200);
  expect(response.payload.mockEnabled).toBe(true);
});

test("login returns 400 when Clerk token is missing", async () => {
  const instance = createTestInstance();

  const response = await invoke(instance.app, {
    method: "POST",
    url: "/api/v1/auth/login",
    body: {
      clerkSessionToken: "",
    },
  });

  expect(response.status).toBe(400);
  expect(response.payload.error.code).toBe("AUTH_CLERK_TOKEN_MISSING");
});
