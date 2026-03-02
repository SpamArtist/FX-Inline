import { createHmac } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ccx-backend-tests-"));
const dbFile = path.join(tempRoot, "db.json");

process.env.BACKEND_DB_FILE = dbFile;
process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
process.env.TRIAL_PERIOD_DAYS = "7";
process.env.FREE_DAILY_LIMIT = "5";
process.env.PAID_DAILY_LIMIT = "100";
process.env.RATE_PAID_TTL_MS = "60000";
process.env.RATE_STALE_ALERT_MS = "180000";
process.env.STRIPE_SECRET_KEY = "";
process.env.STRIPE_PRICE_ID = "";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
process.env.ADMIN_API_KEY = "test-admin-key";
process.env.BACKEND_PUBLIC_BASE_URL = "http://127.0.0.1:8787";

const {
  mutateDb,
  readDb,
} = await import("../dist/db.js");

const {
  hashPassword,
  verifyPassword,
  base64UrlEncode,
  base64UrlDecode,
} = await import("../dist/crypto.js");

const {
  signUp,
  signIn,
  rotateRefreshToken,
  logout,
  requireAuthedUser,
} = await import("../dist/auth.js");

const {
  getEntitlementRecord,
  getEntitlementView,
  recordUsage,
  setEntitlement,
} = await import("../dist/entitlements.js");

const {
  createCheckoutSession,
  createCustomerPortalSession,
  handleStripeWebhook,
} = await import("../dist/billing.js");

const {
  getRatesForPlan,
  getRatesForUser,
} = await import("../dist/rates.js");

const {
  getAdminStats,
  getAdminAlerts,
  getAdminDashboardHtml,
} = await import("../dist/admin.js");

const originalFetch = globalThis.fetch;

function buildRates(multiplier = 1) {
  const base = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 152,
    CAD: 1.34,
    AUD: 1.51,
    CHF: 0.89,
    CNY: 7.19,
    SEK: 10.4,
    NZD: 1.63,
    MXN: 16.9,
    SGD: 1.34,
    HKD: 7.81,
    NOK: 10.8,
    KRW: 1332,
    TRY: 32.7,
    INR: 82.9,
    BRL: 5.1,
    ZAR: 18.3,
    AED: 3.67,
    PLN: 3.99,
    DKK: 6.87,
    THB: 36.4,
    IDR: 15710,
    HUF: 365,
    CZK: 23.2,
    ILS: 3.71,
    CLP: 915,
    PHP: 56.2,
    PKR: 278,
  };

  return Object.fromEntries(
    Object.entries(base).map(([code, rate]) => [code, Number((rate * multiplier).toFixed(6))]),
  );
}

function createMockResponse(body, options = {}) {
  const status = options.status ?? 200;
  const ok = options.ok ?? (status >= 200 && status < 300);

  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function installFetchSequence(sequence) {
  let callCount = 0;

  globalThis.fetch = async () => {
    const current = sequence[Math.min(callCount, sequence.length - 1)];
    callCount += 1;

    if (current.throw) {
      throw new Error(current.throw);
    }

    return createMockResponse(current.body, current);
  };

  return {
    getCallCount: () => callCount,
  };
}

function createStripeSignature(rawBody, secret, timestamp = 1700000000) {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return `t=${timestamp},v1=${digest}`;
}

async function resetDb() {
  await mutateDb((db) => {
    db.users = [];
    db.refreshSessions = [];
    db.entitlements = [];
    db.usageCounters = [];
    db.rateCaches.free = null;
    db.rateCaches.paid = null;
    db.providerHealth = [];
    db.alerts = [];
    db.webhookEvents = [];
  });
}

async function prepareTest() {
  await resetDb();
  globalThis.fetch = originalFetch;
}

test("crypto helpers hash and verify password + base64url roundtrip", async () => {
  await prepareTest();

  const password = "super-secret-password";
  const hashed = hashPassword(password);

  expect(hashed).not.toBe(password);
  expect(verifyPassword(password, hashed)).toBe(true);
  expect(verifyPassword("wrong-password", hashed)).toBe(false);

  const raw = "header.payload.signature";
  const encoded = base64UrlEncode(raw);
  expect(base64UrlDecode(encoded)).toBe(raw);
});

test("auth flow: signup, signin, requireAuthedUser", async () => {
  await prepareTest();

  const signup = await signUp("User@Example.com", "password123");

  expect(signup.user.email).toBe("user@example.com");
  expect(signup.tokens.accessToken.length).toBeGreaterThan(20);
  expect(signup.tokens.refreshToken.length).toBeGreaterThan(20);

  const me = await requireAuthedUser(signup.tokens.accessToken);
  expect(me.id).toBe(signup.user.id);

  const signin = await signIn("user@example.com", "password123");
  expect(signin.user.id).toBe(signup.user.id);

  await expect(signIn("user@example.com", "bad-password")).rejects.toThrow(
    /Invalid credentials/,
  );
});

test("auth flow: refresh token rotation revokes old session", async () => {
  await prepareTest();

  const signup = await signUp("rotate@example.com", "password123");

  const rotated = await rotateRefreshToken(signup.tokens.refreshToken);
  expect(rotated.tokens.refreshToken).not.toBe(signup.tokens.refreshToken);

  await expect(rotateRefreshToken(signup.tokens.refreshToken)).rejects.toThrow(
    /revoked|invalid/i,
  );
});

test("auth flow: logout revokes refresh session", async () => {
  await prepareTest();

  const signup = await signUp("logout@example.com", "password123");

  await logout(signup.tokens.refreshToken);

  await expect(rotateRefreshToken(signup.tokens.refreshToken)).rejects.toThrow(
    /revoked|invalid/i,
  );
});

test("entitlements default to trial and usage limits enforce on free tier", async () => {
  await prepareTest();

  const signup = await signUp("limits@example.com", "password123");

  const initial = await getEntitlementRecord(signup.user.id);
  expect(initial.status).toBe("trial");
  expect(initial.planTier).toBe("paid");

  await setEntitlement(signup.user.id, {
    status: "free",
    planTier: "free",
  });

  const usage1 = await recordUsage(signup.user.id, {
    inlineConversions: 3,
    selectionConversions: 1,
  });

  expect(usage1.limited).toBe(false);
  expect(usage1.remainingToday).toBe(1);

  const usage2 = await recordUsage(signup.user.id, {
    inlineConversions: 2,
    selectionConversions: 0,
  });

  expect(usage2.limited).toBe(true);
  expect(usage2.remainingToday).toBe(0);
});

test("billing returns mock checkout and portal URLs without Stripe keys", async () => {
  await prepareTest();

  const checkout = await createCheckoutSession({
    userId: "usr_mock",
    email: "mock@example.com",
    successUrl: "https://example.com/success",
    cancelUrl: "https://example.com/cancel",
  });

  expect(checkout.mode).toBe("mock");
  expect(checkout.checkoutUrl).toMatch(/mock-checkout/);

  const portal = await createCustomerPortalSession({
    userId: "usr_mock",
    email: "mock@example.com",
    returnUrl: "https://example.com/return",
  });

  expect(portal.mode).toBe("mock");
  expect(portal.portalUrl).toMatch(/mock-portal/);
});

test("webhook checkout completion upgrades entitlement", async () => {
  await prepareTest();

  const signup = await signUp("checkout@example.com", "password123");
  await setEntitlement(signup.user.id, { status: "free", planTier: "free" });

  const payload = JSON.stringify({
    id: "evt_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        customer: "cus_123",
        metadata: {
          userId: signup.user.id,
        },
      },
    },
  });

  const signature = createStripeSignature(payload, "whsec_test");
  await handleStripeWebhook(payload, signature);

  const entitlement = await getEntitlementView(signup.user.id);
  expect(entitlement.status).toBe("paid");

  const db = await readDb();
  const webhook = db.webhookEvents.find((entry) => entry.id === "evt_checkout");
  expect(webhook?.status).toBe("processed");
});

test("webhook subscription deletion cancels entitlement", async () => {
  await prepareTest();

  const signup = await signUp("cancel@example.com", "password123");

  const upgradePayload = JSON.stringify({
    id: "evt_upgrade",
    type: "checkout.session.completed",
    data: {
      object: {
        customer: "cus_cancel",
        metadata: {
          userId: signup.user.id,
        },
      },
    },
  });

  await handleStripeWebhook(
    upgradePayload,
    createStripeSignature(upgradePayload, "whsec_test"),
  );

  const deletePayload = JSON.stringify({
    id: "evt_deleted",
    type: "customer.subscription.deleted",
    data: {
      object: {
        customer: "cus_cancel",
      },
    },
  });

  await handleStripeWebhook(
    deletePayload,
    createStripeSignature(deletePayload, "whsec_test"),
  );

  const entitlement = await getEntitlementView(signup.user.id);
  expect(entitlement.status).toBe("canceled");
  expect(entitlement.planTier).toBe("free");
});

test("webhook rejects invalid signature when secret is configured", async () => {
  await prepareTest();

  const payload = JSON.stringify({
    id: "evt_invalid_sig",
    type: "checkout.session.completed",
    data: { object: { metadata: { userId: "usr_missing" } } },
  });

  await expect(handleStripeWebhook(payload, "t=1,v1=invalid")).rejects.toThrow(
    /Invalid webhook signature/,
  );
});

test("rates: provider fallback works when primary fails", async () => {
  await prepareTest();

  const tracker = installFetchSequence([
    { ok: false, status: 500, body: { error: "primary down" } },
    { ok: true, body: { rates: buildRates(1) } },
  ]);

  const snapshot = await getRatesForPlan("free", true);

  expect(snapshot.source).toBe("exchange-rate-api");
  expect(snapshot.marketDayKey).toBeTruthy();
  expect(tracker.getCallCount()).toBe(2);
});

test("rates: cached snapshot is returned when all providers fail", async () => {
  await prepareTest();

  installFetchSequence([
    { ok: true, body: { result: "success", rates: buildRates(1) } },
  ]);

  const initial = await getRatesForPlan("paid", true);

  installFetchSequence([
    { throw: "primary failed" },
    { throw: "fallback failed" },
  ]);

  const fallback = await getRatesForPlan("paid", true);
  expect(fallback.fetchedAt).toBe(initial.fetchedAt);
  expect(fallback.source).toBe(initial.source);
});

test("rates: low-quality payload fails when cache is empty", async () => {
  await prepareTest();

  installFetchSequence([
    { ok: true, body: { result: "success", rates: { USD: 1, EUR: 0.9 } } },
    { ok: true, body: { rates: { USD: 1, EUR: 0.9 } } },
  ]);

  await expect(getRatesForPlan("free", true)).rejects.toThrow(
    /All rate providers failed/,
  );
});

test("rates: user plan resolution picks paid for trial user and free for anonymous", async () => {
  await prepareTest();

  installFetchSequence([
    { ok: true, body: { result: "success", rates: buildRates(1) } },
  ]);

  const signup = await signUp("rates-user@example.com", "password123");

  const paidResult = await getRatesForUser(signup.user.id, true);
  expect(paidResult.planTier).toBe("paid");

  installFetchSequence([
    { ok: true, body: { result: "success", rates: buildRates(1) } },
  ]);

  const freeResult = await getRatesForUser(null, true);
  expect(freeResult.planTier).toBe("free");
});

test("admin endpoints enforce key and report operational stats", async () => {
  await prepareTest();

  const signup = await signUp("admin@example.com", "password123");
  await setEntitlement(signup.user.id, { status: "paid", planTier: "paid" });

  await expect(getAdminStats(undefined)).rejects.toThrow(/Forbidden/);

  const stats = await getAdminStats("test-admin-key");
  expect(stats.users.total).toBe(1);
  expect(stats.users.paidOrTrial).toBe(1);

  const alerts = await getAdminAlerts("test-admin-key");
  expect(Array.isArray(alerts)).toBe(true);

  const html = await getAdminDashboardHtml("test-admin-key");
  expect(html).toMatch(/Currency SaaS Admin Dashboard/);
});
