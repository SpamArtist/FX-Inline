import http from "node:http";
import { config } from "./config.js";
import {
  logout,
  requireAuthedUser,
  rotateRefreshToken,
  signIn,
  signUp,
} from "./auth.js";
import { getEntitlementView, recordUsage } from "./entitlements.js";
import { createCheckoutSession, createCustomerPortalSession, handleStripeWebhook } from "./billing.js";
import { getRatesForUser } from "./rates.js";
import { getAdminAlerts, getAdminDashboardHtml, getAdminStats } from "./admin.js";
import {
  getOriginFromRequest,
  parseBearerToken,
  readJsonBody,
  readRawBody,
  sendJson,
  sendText,
  setCorsHeaders,
} from "./http.js";

type AuthBody = {
  email?: string;
  password?: string;
};

type RefreshBody = {
  refreshToken?: string;
};

type UsageBody = {
  inlineConversions?: number;
  selectionConversions?: number;
};

type CheckoutBody = {
  successUrl?: string;
  cancelUrl?: string;
};

type PortalBody = {
  returnUrl?: string;
};

function formatAuthResponse(result: Awaited<ReturnType<typeof signIn>>) {
  return {
    user: result.user,
    auth: result.tokens,
    entitlement: result.entitlement,
  };
}

async function requireTokenUser(authHeader: string | undefined) {
  const token = parseBearerToken(authHeader);
  if (!token) {
    throw new Error("Unauthorized");
  }

  return requireAuthedUser(token);
}

async function resolveOptionalUser(authHeader: string | undefined) {
  const token = parseBearerToken(authHeader);
  if (!token) return null;

  return requireAuthedUser(token);
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!req.url) {
      sendJson(res, 400, { error: "Missing URL" });
      return;
    }

    const url = new URL(req.url, config.publicBaseUrl);

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true, now: Date.now() });
        return;
      }

      if (req.method === "POST" && url.pathname === "/auth/signup") {
        const body = await readJsonBody<AuthBody>(req);
        const result = await signUp(body.email || "", body.password || "");
        sendJson(res, 201, formatAuthResponse(result));
        return;
      }

      if (req.method === "POST" && url.pathname === "/auth/signin") {
        const body = await readJsonBody<AuthBody>(req);
        const result = await signIn(body.email || "", body.password || "");
        sendJson(res, 200, formatAuthResponse(result));
        return;
      }

      if (req.method === "POST" && url.pathname === "/auth/refresh") {
        const body = await readJsonBody<RefreshBody>(req);

        if (!body.refreshToken) {
          sendJson(res, 400, { error: "refreshToken is required" });
          return;
        }

        const result = await rotateRefreshToken(body.refreshToken);
        sendJson(res, 200, formatAuthResponse(result));
        return;
      }

      if (req.method === "POST" && url.pathname === "/auth/logout") {
        const body = await readJsonBody<RefreshBody>(req);

        if (!body.refreshToken) {
          sendJson(res, 400, { error: "refreshToken is required" });
          return;
        }

        await logout(body.refreshToken);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && url.pathname === "/auth/me") {
        const authed = await requireTokenUser(req.headers.authorization);
        const entitlement = await getEntitlementView(authed.id);

        sendJson(res, 200, {
          user: authed,
          entitlement,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/entitlements/me") {
        const authed = await requireTokenUser(req.headers.authorization);
        const entitlement = await getEntitlementView(authed.id);

        sendJson(res, 200, { entitlement });
        return;
      }

      if (req.method === "POST" && url.pathname === "/billing/checkout-session") {
        const authed = await requireTokenUser(req.headers.authorization);
        const body = await readJsonBody<CheckoutBody>(req);
        const origin = getOriginFromRequest(req);

        const result = await createCheckoutSession({
          userId: authed.id,
          email: authed.email,
          successUrl: body.successUrl || `${origin}/billing/success`,
          cancelUrl: body.cancelUrl || `${origin}/billing/cancel`,
        });

        sendJson(res, 200, result);
        return;
      }

      if (req.method === "POST" && url.pathname === "/billing/customer-portal") {
        const authed = await requireTokenUser(req.headers.authorization);
        const body = await readJsonBody<PortalBody>(req);
        const origin = getOriginFromRequest(req);

        const result = await createCustomerPortalSession({
          userId: authed.id,
          email: authed.email,
          returnUrl: body.returnUrl || `${origin}/billing/portal-return`,
        });

        sendJson(res, 200, result);
        return;
      }

      if (req.method === "POST" && url.pathname === "/billing/webhook") {
        const signature = String(req.headers["stripe-signature"] || "");
        const rawBody = await readRawBody(req);

        await handleStripeWebhook(rawBody, signature);

        sendJson(res, 200, { received: true });
        return;
      }

      if (req.method === "GET" && url.pathname === "/rates/latest") {
        const authed = await resolveOptionalUser(req.headers.authorization);
        const forceRefresh = url.searchParams.get("force") === "1";

        const result = await getRatesForUser(authed?.id || null, forceRefresh);

        sendJson(res, 200, {
          snapshot: result.snapshot,
          planTier: result.planTier,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/usage/events") {
        const authed = await requireTokenUser(req.headers.authorization);
        const body = await readJsonBody<UsageBody>(req);

        const usage = await recordUsage(authed.id, {
          inlineConversions: body.inlineConversions || 0,
          selectionConversions: body.selectionConversions || 0,
        });

        sendJson(res, 200, usage);
        return;
      }

      if (req.method === "GET" && url.pathname === "/admin/stats") {
        const stats = await getAdminStats(
          typeof req.headers["x-admin-key"] === "string"
            ? req.headers["x-admin-key"]
            : undefined,
        );

        sendJson(res, 200, stats);
        return;
      }

      if (req.method === "GET" && url.pathname === "/admin/alerts") {
        const alerts = await getAdminAlerts(
          typeof req.headers["x-admin-key"] === "string"
            ? req.headers["x-admin-key"]
            : undefined,
        );

        sendJson(res, 200, { alerts });
        return;
      }

      if (req.method === "GET" && url.pathname === "/admin") {
        const html = await getAdminDashboardHtml(
          typeof req.headers["x-admin-key"] === "string"
            ? req.headers["x-admin-key"]
            : undefined,
        );

        sendText(res, 200, html, "text/html; charset=utf-8");
        return;
      }

      if (req.method === "GET" && url.pathname === "/billing/mock-checkout") {
        sendText(
          res,
          200,
          `<html><body style="font-family:system-ui;padding:24px"><h1>Mock Checkout</h1><p>This is a local fallback checkout page. Trigger Stripe webhooks in production to move users to paid.</p></body></html>`,
          "text/html; charset=utf-8",
        );
        return;
      }

      if (req.method === "GET" && url.pathname === "/billing/mock-portal") {
        sendText(
          res,
          200,
          `<html><body style="font-family:system-ui;padding:24px"><h1>Mock Billing Portal</h1><p>This is a local fallback customer portal.</p></body></html>`,
          "text/html; charset=utf-8",
        );
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      const isAuthError = message === "Unauthorized";
      const isForbidden = message === "Forbidden";

      if (isAuthError) {
        sendJson(res, 401, { error: message });
        return;
      }

      if (isForbidden) {
        sendJson(res, 403, { error: message });
        return;
      }

      if (req.method === "POST" && req.url.startsWith("/auth")) {
        sendJson(res, 400, { error: message });
        return;
      }

      sendJson(res, 500, { error: message });
    }
  });

  server.listen(config.port, config.host, () => {
    // Keep startup logs free of secrets.
    console.log(`Backend listening on http://${config.host}:${config.port}`);
  });
}

startServer();
