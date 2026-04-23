export function parseJsonSafe<T>(input: string | null | undefined, fallback: T): T {
  if (typeof input !== "string") return fallback;

  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, normalizeValue(nestedValue)]),
    );
  }

  return value;
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}
