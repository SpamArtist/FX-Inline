export function parseJsonSafe(input, fallback = null) {
  if (typeof input !== "string") return fallback;

  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, normalizeValue(nestedValue)]),
    );
  }

  return value;
}

export function canonicalizeJson(value) {
  return JSON.stringify(normalizeValue(value));
}
