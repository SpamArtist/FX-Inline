import { createHmac } from "node:crypto";
import { config } from "./config.js";
import { createId } from "./crypto.js";
import {
  findUserByStripeCustomerId,
  getUserById,
  updateStripeCustomerId,
} from "./auth.js";
import { mutateDb } from "./db.js";
import { setEntitlement } from "./entitlements.js";
import { openAlert } from "./alerts.js";

function formEncode(payload: Record<string, string>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    body.set(key, value);
  }
  return body;
}

async function stripeRequest<T>(
  path: string,
  method: "POST" | "GET",
  body?: URLSearchParams,
): Promise<T> {
  if (!config.stripeSecretKey) {
    throw new Error("Stripe is not configured");
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe request failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
}

async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  if (!config.stripeSecretKey) {
    const mockCustomerId = `cus_mock_${userId}`;
    await updateStripeCustomerId(userId, mockCustomerId);
    return mockCustomerId;
  }

  const created = await stripeRequest<{ id: string }>(
    "/v1/customers",
    "POST",
    formEncode({
      email,
      "metadata[userId]": userId,
    }),
  );

  await updateStripeCustomerId(userId, created.id);
  return created.id;
}

export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ checkoutUrl: string; sessionId: string; mode: "mock" | "stripe" }> {
  if (!config.stripeSecretKey || !config.stripePriceId) {
    return {
      checkoutUrl: `${config.publicBaseUrl}/billing/mock-checkout?userId=${encodeURIComponent(params.userId)}`,
      sessionId: createId("sess_mock"),
      mode: "mock",
    };
  }

  const customerId = await ensureStripeCustomer(params.userId, params.email);

  const session = await stripeRequest<{ id: string; url: string }>(
    "/v1/checkout/sessions",
    "POST",
    formEncode({
      mode: "subscription",
      customer: customerId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      "line_items[0][price]": config.stripePriceId,
      "line_items[0][quantity]": "1",
      "metadata[userId]": params.userId,
    }),
  );

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    mode: "stripe",
  };
}

export async function createCustomerPortalSession(params: {
  userId: string;
  email: string;
  returnUrl: string;
}): Promise<{ portalUrl: string; mode: "mock" | "stripe" }> {
  if (!config.stripeSecretKey) {
    return {
      portalUrl: `${config.publicBaseUrl}/billing/mock-portal?userId=${encodeURIComponent(params.userId)}`,
      mode: "mock",
    };
  }

  const customerId = await ensureStripeCustomer(params.userId, params.email);

  const portal = await stripeRequest<{ url: string }>(
    "/v1/billing_portal/sessions",
    "POST",
    formEncode({
      customer: customerId,
      return_url: params.returnUrl,
    }),
  );

  return {
    portalUrl: portal.url,
    mode: "stripe",
  };
}

function verifyStripeSignature(rawBody: string, signatureHeader: string): boolean {
  const secret = config.stripeWebhookSecret;
  if (!secret) return true;

  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, entry) => {
    const [key, value] = entry.split("=");
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) return false;

  const payloadToSign = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(payloadToSign).digest("hex");

  return expected === signature;
}

function mapStripeSubscriptionStatus(status: string): {
  nextStatus: "paid" | "trial" | "canceled" | "free";
  planTier: "paid" | "free";
} {
  if (status === "trialing") {
    return {
      nextStatus: "trial",
      planTier: "paid",
    };
  }

  if (status === "active") {
    return {
      nextStatus: "paid",
      planTier: "paid",
    };
  }

  if (status === "canceled" || status === "unpaid" || status === "past_due") {
    return {
      nextStatus: "canceled",
      planTier: "free",
    };
  }

  return {
    nextStatus: "free",
    planTier: "free",
  };
}

async function recordWebhookEvent(event: {
  id: string;
  type: string;
  status: "received" | "processed" | "failed";
  error?: string;
}) {
  await mutateDb((draft) => {
    const existing = draft.webhookEvents.find((entry) => entry.id === event.id);
    if (existing) {
      existing.status = event.status;
      existing.processedAt = Date.now();
      existing.error = event.error || null;
      return;
    }

    draft.webhookEvents.push({
      id: event.id,
      type: event.type,
      receivedAt: Date.now(),
      processedAt: event.status === "received" ? null : Date.now(),
      status: event.status,
      error: event.error || null,
    });
  });
}

async function processStripeEvent(payload: any): Promise<void> {
  const eventType = payload?.type as string;
  const eventId = (payload?.id as string) || createId("evt");

  await recordWebhookEvent({ id: eventId, type: eventType || "unknown", status: "received" });

  if (eventType === "checkout.session.completed") {
    const session = payload.data?.object as {
      customer?: string;
      metadata?: Record<string, string>;
    };

    const userId = session?.metadata?.userId;

    if (userId) {
      await setEntitlement(userId, {
        status: "paid",
        planTier: "paid",
        source: "stripe",
        canceledAt: null,
      });

      if (session.customer) {
        await updateStripeCustomerId(userId, session.customer);
      }
    }

    await recordWebhookEvent({ id: eventId, type: eventType, status: "processed" });
    return;
  }

  if (eventType === "customer.subscription.updated") {
    const subscription = payload.data?.object as {
      status?: string;
      customer?: string;
      current_period_end?: number;
      trial_end?: number;
      canceled_at?: number;
      metadata?: Record<string, string>;
    };

    let userId = subscription?.metadata?.userId;

    if (!userId && subscription?.customer) {
      const user = await findUserByStripeCustomerId(subscription.customer);
      userId = user?.id;
    }

    if (userId) {
      const mapped = mapStripeSubscriptionStatus(subscription.status || "");

      await setEntitlement(userId, {
        status: mapped.nextStatus,
        planTier: mapped.planTier,
        source: "stripe",
        currentPeriodEnd: subscription.current_period_end
          ? subscription.current_period_end * 1000
          : null,
        trialEndsAt: subscription.trial_end ? subscription.trial_end * 1000 : null,
        canceledAt: subscription.canceled_at ? subscription.canceled_at * 1000 : null,
      });
    }

    await recordWebhookEvent({ id: eventId, type: eventType, status: "processed" });
    return;
  }

  if (eventType === "customer.subscription.deleted") {
    const subscription = payload.data?.object as {
      customer?: string;
      metadata?: Record<string, string>;
    };

    let userId = subscription?.metadata?.userId;

    if (!userId && subscription?.customer) {
      const user = await findUserByStripeCustomerId(subscription.customer);
      userId = user?.id;
    }

    if (userId) {
      await setEntitlement(userId, {
        status: "canceled",
        planTier: "free",
        source: "stripe",
        canceledAt: Date.now(),
      });
    }

    await recordWebhookEvent({ id: eventId, type: eventType, status: "processed" });
    return;
  }

  await recordWebhookEvent({ id: eventId, type: eventType || "unknown", status: "processed" });
}

export async function handleStripeWebhook(rawBody: string, signatureHeader: string): Promise<void> {
  if (!verifyStripeSignature(rawBody, signatureHeader)) {
    throw new Error("Invalid webhook signature");
  }

  let payload: any;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid webhook payload");
  }

  try {
    await processStripeEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";

    await openAlert({
      code: "stripe-webhook-failure",
      level: "critical",
      message,
    });

    await recordWebhookEvent({
      id: payload?.id || createId("evt"),
      type: payload?.type || "unknown",
      status: "failed",
      error: message,
    });

    throw error;
  }
}
