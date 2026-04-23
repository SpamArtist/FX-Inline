function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    const sortedEntries = Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, nested]) => [key, normalizeValue(nested)]);

    return Object.fromEntries(sortedEntries);
  }

  return value;
}

export function canonicalizeJson(value) {
  return JSON.stringify(normalizeValue(value));
}
