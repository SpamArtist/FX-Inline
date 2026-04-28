import {
  normalizeDomainScope,
  normalizePageScope,
} from "#admin-settings/manifest";

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeDomain(value) {
  return normalizeDomainScope(value) ?? "";
}

export function normalizePageUrl(value) {
  return normalizePageScope(value) ?? "";
}

export function getPageDomain(pageUrl) {
  try {
    return new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function getScopeKey(scope) {
  return scope.type === "all_urls" ? "All Pages" : scope.id;
}

export function getDomainPages(manifest, domain) {
  return Object.entries(manifest.scopes.pages)
    .filter(([, settings]) => settings.domain === domain)
    .sort(([left], [right]) => left.localeCompare(right));
}
