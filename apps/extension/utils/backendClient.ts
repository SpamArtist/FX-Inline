import {
  AuthResponsePayload,
  EntitlementPayload,
  RatesResponsePayload,
  UsageResponsePayload,
} from "@/packages/shared/contracts";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8787";

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function resolveBackendBaseUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;

  return normalizeBaseUrl(
    env.WXT_BACKEND_BASE_URL || env.VITE_BACKEND_BASE_URL || DEFAULT_BACKEND_BASE_URL,
  );
}

const BACKEND_BASE_URL = resolveBackendBaseUrl();

export function getBackendBaseUrl(): string {
  return BACKEND_BASE_URL;
}

async function requestJson<T>(
  path: string,
  options?: {
    method?: "GET" | "POST";
    accessToken?: string | null;
    body?: unknown;
  },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options?.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    method: options?.method || "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json()) as { error?: string } & T;

  if (!response.ok) {
    throw new Error(payload.error || `Backend request failed (${response.status})`);
  }

  return payload;
}

export function signUpWithBackend(
  email: string,
  password: string,
): Promise<AuthResponsePayload> {
  return requestJson<AuthResponsePayload>("/auth/signup", {
    method: "POST",
    body: { email, password },
  });
}

export function signInWithBackend(
  email: string,
  password: string,
): Promise<AuthResponsePayload> {
  return requestJson<AuthResponsePayload>("/auth/signin", {
    method: "POST",
    body: { email, password },
  });
}

export function refreshSessionWithBackend(
  refreshToken: string,
): Promise<AuthResponsePayload> {
  return requestJson<AuthResponsePayload>("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
}

export async function logoutWithBackend(refreshToken: string): Promise<void> {
  await requestJson<{ ok: true }>("/auth/logout", {
    method: "POST",
    body: { refreshToken },
  });
}

export async function getEntitlementFromBackend(
  accessToken: string,
): Promise<EntitlementPayload> {
  const response = await requestJson<{ entitlement: EntitlementPayload }>(
    "/entitlements/me",
    {
      accessToken,
    },
  );

  return response.entitlement;
}

export function getRatesFromBackend(
  accessToken: string | null,
  options?: { forceRefresh?: boolean },
): Promise<RatesResponsePayload> {
  const query = options?.forceRefresh ? "?force=1" : "";

  return requestJson<RatesResponsePayload>(`/rates/latest${query}`, {
    accessToken,
  });
}

export function createCheckoutSessionOnBackend(
  accessToken: string,
  payload: {
    successUrl: string;
    cancelUrl: string;
  },
): Promise<{ checkoutUrl: string; sessionId: string; mode: "mock" | "stripe" }> {
  return requestJson("/billing/checkout-session", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

export function createCustomerPortalSessionOnBackend(
  accessToken: string,
  payload: {
    returnUrl: string;
  },
): Promise<{ portalUrl: string; mode: "mock" | "stripe" }> {
  return requestJson("/billing/customer-portal", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

export function recordUsageOnBackend(
  accessToken: string,
  payload: {
    inlineConversions: number;
    selectionConversions: number;
  },
): Promise<UsageResponsePayload> {
  return requestJson("/usage/events", {
    method: "POST",
    accessToken,
    body: payload,
  });
}
