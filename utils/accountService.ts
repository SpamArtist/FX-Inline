import {
  createCheckoutSessionOnBackend,
  createCustomerPortalSessionOnBackend,
  getEntitlementFromBackend,
  logoutWithBackend,
  refreshSessionWithBackend,
  signInWithBackend,
  signUpWithBackend,
} from "./backendClient";
import {
  applyAuthPayload,
  applyEntitlementPayload,
  clearAuthSession,
  getUserSettings,
  isAccessTokenExpired,
  setUserSettings,
} from "./appStorage";

export type AuthMode = "signup" | "signin";

export async function authenticateWithBackend(params: {
  mode: AuthMode;
  email: string;
  password: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();

  const response =
    params.mode === "signup"
      ? await signUpWithBackend(normalizedEmail, params.password)
      : await signInWithBackend(normalizedEmail, params.password);

  const current = await getUserSettings();

  const withAuth = applyAuthPayload(current, response.auth, response.user.email);
  const withEntitlement = applyEntitlementPayload(withAuth, response.entitlement);

  return setUserSettings(withEntitlement);
}

export async function refreshAuthSessionIfNeeded(force = false) {
  const current = await getUserSettings();

  if (!current.auth.refreshToken) {
    return current;
  }

  if (!force && !isAccessTokenExpired(current)) {
    return current;
  }

  const refreshed = await refreshSessionWithBackend(current.auth.refreshToken);
  const withAuth = applyAuthPayload(current, refreshed.auth, refreshed.user.email);
  const withEntitlement = applyEntitlementPayload(withAuth, refreshed.entitlement);

  return setUserSettings(withEntitlement);
}

export async function getValidAccessToken(forceRefresh = false): Promise<string | null> {
  const settings = await getUserSettings();

  if (!settings.auth.refreshToken && !settings.auth.accessToken) {
    return null;
  }

  try {
    const hydrated = await refreshAuthSessionIfNeeded(forceRefresh);
    return hydrated.auth.accessToken;
  } catch {
    await clearAuthSession();
    return null;
  }
}

export async function syncEntitlementWithBackend() {
  const token = await getValidAccessToken();
  if (!token) {
    return getUserSettings();
  }

  const entitlement = await getEntitlementFromBackend(token);
  const current = await getUserSettings();
  const next = applyEntitlementPayload(current, entitlement);

  return setUserSettings(next);
}

export async function signOutFromBackend() {
  const current = await getUserSettings();

  if (current.auth.refreshToken) {
    try {
      await logoutWithBackend(current.auth.refreshToken);
    } catch {
      // ignore backend logout errors when clearing local auth state
    }
  }

  return clearAuthSession();
}

export async function createCheckoutSession() {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Sign in required");
  }

  return createCheckoutSessionOnBackend(token, {
    successUrl: "https://example.com/billing/success",
    cancelUrl: "https://example.com/billing/cancel",
  });
}

export async function createCustomerPortalSession() {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Sign in required");
  }

  return createCustomerPortalSessionOnBackend(token, {
    returnUrl: "https://example.com/billing/return",
  });
}
