export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeDomain(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizePageUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function getPageDomain(pageUrl) {
  try {
    return new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function getScopeKey(scope) {
  return scope.type === "all_urls" ? "all_urls" : scope.id;
}

export function getDomainPages(manifest, domain) {
  return Object.entries(manifest.scopes.pages)
    .filter(([, settings]) => settings.domain === domain)
    .sort(([left], [right]) => left.localeCompare(right));
}
