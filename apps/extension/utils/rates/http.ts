import type { JsonValue } from "../json.types";

const RATE_FETCH_TIMEOUT_MS = 8_000;

export async function fetchRateProviderPayload(url: string): Promise<JsonValue> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, RATE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as JsonValue;
  } finally {
    clearTimeout(timeoutId);
  }
}
