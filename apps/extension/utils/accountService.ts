import { getUserSettings } from "./appStorage";

export type AuthMode = "signup" | "signin";

export async function authenticateWithBackend(params: {
  mode: AuthMode;
  email: string;
  password: string;
}) {
  void params;
  throw new Error("Authentication is temporarily disabled.");
}

export async function refreshAuthSessionIfNeeded(force = false) {
  void force;
  return getUserSettings();
}

export async function getValidAccessToken(forceRefresh = false): Promise<string | null> {
  void forceRefresh;
  return null;
}

export async function syncEntitlementWithBackend() {
  return getUserSettings();
}

export async function signOutFromBackend() {
  return getUserSettings();
}

export async function createCheckoutSession() {
  throw new Error("Paid features are temporarily disabled.");
}

export async function createCustomerPortalSession() {
  throw new Error("Paid features are temporarily disabled.");
}
