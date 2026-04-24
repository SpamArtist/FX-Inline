import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createServerInstance } from "../dist/server.js";

const activeInstances = [];

function createTestDatabaseUrl() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cp-api-test-"));
  return `pglite://${path.join(directory, "control-plane-test.pgdata")}`;
}

async function createTestInstance() {
  const databaseUrl = createTestDatabaseUrl();

  const instance = await createServerInstance({
    NODE_ENV: "test",
    CONTROL_PLANE_HOST: "127.0.0.1",
    CONTROL_PLANE_PORT: "8787",
    CONTROL_PLANE_DATABASE_URL: databaseUrl,
    CONTROL_PLANE_DASHBOARD_URL: "http://127.0.0.1:5174",
    CONTROL_PLANE_PUBLIC_ORIGIN: "http://127.0.0.1:8787",
    CONTROL_PLANE_ENABLE_MOCK_CLERK: "true",
    CONTROL_PLANE_MANIFEST_PRIVATE_KEY_PATH: "",
  });

  activeInstances.push(instance);
  return instance;
}

async function allowEmailDomain(instance, domain) {
  await instance.database.addAllowedEmailDomain({
    domain,
    createdByUserId: null,
  });
}

async function bootstrapPlatformAdmin(instance, email) {
  await instance.database.upsertPlatformAdminIdentity({
    email,
    clerkUserId: null,
    createdByUserId: null,
  });
}

afterEach(async () => {
  while (activeInstances.length) {
    const instance = activeInstances.pop();
    if (instance?.database?.close) {
      await instance.database.close();
    }
  }
});

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

async function loginAsMockUser(app, {
  clerkUserId,
  clerkSessionId,
  email,
  displayName,
}) {
  return invoke(app, {
    method: "POST",
    url: "/api/v1/auth/login",
    body: {
      clerkSessionToken: makeMockClerkToken({
        clerkUserId,
        clerkSessionId,
        email,
        displayName,
      }),
    },
  });
}

test("health and readiness endpoints return success", async () => {
  const instance = await createTestInstance();

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
  const instance = await createTestInstance();
  await allowEmailDomain(instance, "example.com");

  const login = await loginAsMockUser(instance.app, {
    clerkUserId: "user_owner",
    clerkSessionId: "sess_owner",
    email: "owner@example.com",
    displayName: "Owner",
  });

  expect(login.status).toBe(200);
  expect(login.payload.user.email).toBe("owner@example.com");
  expect(login.payload.user.clerkUserId).toBe("user_owner");
  expect(login.payload.user.isPlatformAdmin).toBe(false);
  expect(login.payload.created).toBe(true);

  const secondLogin = await loginAsMockUser(instance.app, {
    clerkUserId: "user_owner",
    clerkSessionId: "sess_owner_2",
    email: "owner@example.com",
    displayName: "Owner",
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
  expect(me.payload.user.isPlatformAdmin).toBe(false);
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

test("login rejects non-admin users when allowlist is empty", async () => {
  const instance = await createTestInstance();

  const login = await loginAsMockUser(instance.app, {
    clerkUserId: "user_empty",
    clerkSessionId: "sess_empty",
    email: "user@acme.com",
    displayName: "No Domain",
  });

  expect(login.status).toBe(403);
  expect(login.payload.error.code).toBe("AUTH_DOMAIN_ALLOWLIST_EMPTY");
});

test("login rejects non-admin users from disallowed domains", async () => {
  const instance = await createTestInstance();
  await allowEmailDomain(instance, "acme.com");

  const login = await loginAsMockUser(instance.app, {
    clerkUserId: "user_other",
    clerkSessionId: "sess_other",
    email: "user@other.com",
    displayName: "Other Domain",
  });

  expect(login.status).toBe(403);
  expect(login.payload.error.code).toBe("AUTH_DOMAIN_NOT_ALLOWED");
});

test("admin bypasses allowlist restrictions", async () => {
  const instance = await createTestInstance();
  await bootstrapPlatformAdmin(instance, "admin@outside.com");

  const login = await loginAsMockUser(instance.app, {
    clerkUserId: "user_admin",
    clerkSessionId: "sess_admin",
    email: "admin@outside.com",
    displayName: "Platform Admin",
  });

  expect(login.status).toBe(200);
  expect(login.payload.user.isPlatformAdmin).toBe(true);

  const sessionCookie = parseSetCookie(login.headers);
  const me = await invoke(instance.app, {
    url: "/api/v1/auth/me",
    cookie: sessionCookie,
  });

  expect(me.status).toBe(200);
  expect(me.payload.user.isPlatformAdmin).toBe(true);
});

test("admin allowlist API enforces admin role, csrf, and domain normalization", async () => {
  const instance = await createTestInstance();
  await bootstrapPlatformAdmin(instance, "admin@platform.com");

  const adminLogin = await loginAsMockUser(instance.app, {
    clerkUserId: "user_platform_admin",
    clerkSessionId: "sess_platform_admin",
    email: "admin@platform.com",
    displayName: "Platform Admin",
  });

  expect(adminLogin.status).toBe(200);
  const adminCookie = parseSetCookie(adminLogin.headers);

  const adminCsrf = await invoke(instance.app, {
    url: "/api/v1/auth/csrf",
    cookie: adminCookie,
  });

  expect(adminCsrf.status).toBe(200);

  const addWithoutCsrf = await invoke(instance.app, {
    method: "POST",
    url: "/api/v1/admin/allowed-domains",
    cookie: adminCookie,
    body: {
      domain: "ACME.COM",
    },
  });

  expect(addWithoutCsrf.status).toBe(403);
  expect(addWithoutCsrf.payload.error.code).toBe("CSRF_INVALID");

  const addDomain = await invoke(instance.app, {
    method: "POST",
    url: "/api/v1/admin/allowed-domains",
    cookie: adminCookie,
    csrf: adminCsrf.payload.csrfToken,
    body: {
      domain: "ACME.COM",
    },
  });

  expect(addDomain.status).toBe(201);
  expect(addDomain.payload.domain.domain).toBe("acme.com");

  const listDomains = await invoke(instance.app, {
    url: "/api/v1/admin/allowed-domains",
    cookie: adminCookie,
  });

  expect(listDomains.status).toBe(200);
  expect(listDomains.payload.domains.some((entry) => entry.domain === "acme.com")).toBe(true);

  const allowedUserLogin = await loginAsMockUser(instance.app, {
    clerkUserId: "user_allowed",
    clerkSessionId: "sess_allowed",
    email: "user@acme.com",
    displayName: "Allowed User",
  });

  expect(allowedUserLogin.status).toBe(200);

  const allowedUserCookie = parseSetCookie(allowedUserLogin.headers);

  const nonAdminAdminList = await invoke(instance.app, {
    url: "/api/v1/admin/allowed-domains",
    cookie: allowedUserCookie,
  });

  expect(nonAdminAdminList.status).toBe(403);
  expect(nonAdminAdminList.payload.error.code).toBe("AUTH_ADMIN_FORBIDDEN");

  const deleteWithoutCsrf = await invoke(instance.app, {
    method: "DELETE",
    url: "/api/v1/admin/allowed-domains/ACME.COM",
    cookie: adminCookie,
  });

  expect(deleteWithoutCsrf.status).toBe(403);
  expect(deleteWithoutCsrf.payload.error.code).toBe("CSRF_INVALID");

  const deleteDomain = await invoke(instance.app, {
    method: "DELETE",
    url: "/api/v1/admin/allowed-domains/ACME.COM",
    cookie: adminCookie,
    csrf: adminCsrf.payload.csrfToken,
  });

  expect(deleteDomain.status).toBe(200);
  expect(deleteDomain.payload.removed).toBe(true);
  expect(deleteDomain.payload.domain).toBe("acme.com");

  const loginAfterDelete = await loginAsMockUser(instance.app, {
    clerkUserId: "user_allowed_2",
    clerkSessionId: "sess_allowed_2",
    email: "another@acme.com",
    displayName: "Allowed User 2",
  });

  expect(loginAfterDelete.status).toBe(403);
  expect(loginAfterDelete.payload.error.code).toBe("AUTH_DOMAIN_ALLOWLIST_EMPTY");
});

test("mock Clerk config endpoint indicates mock auth mode", async () => {
  const instance = await createTestInstance();

  const response = await invoke(instance.app, {
    url: "/api/v1/auth/clerk/config",
  });

  expect(response.status).toBe(200);
  expect(response.payload.mockEnabled).toBe(true);
});

test("login returns 400 when Clerk token is missing", async () => {
  const instance = await createTestInstance();

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
