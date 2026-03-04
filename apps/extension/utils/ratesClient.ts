import { RatesResponsePayload } from "@/packages/shared/contracts";

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

const RATES_BACKEND_BASE_URL = resolveBackendBaseUrl();

export function getRatesBackendBaseUrl(): string {
  return RATES_BACKEND_BASE_URL;
}

export async function fetchRatesFromBackend(
  accessToken: string | null,
  options?: { forceRefresh?: boolean },
): Promise<RatesResponsePayload> {
  const query = options?.forceRefresh ? "?force=1" : "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${getRatesBackendBaseUrl()}/rates/latest${query}`, {
    method: "GET",
    headers,
  });

  const payload = (await response.json()) as { error?: string } & RatesResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error || `Backend request failed (${response.status})`);
  }

  return payload;
}
