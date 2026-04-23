import { canonicalizeJson } from "./canonicalize.js";
import { verifyRsaSha256 } from "./crypto.js";

function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRuntimeUrl(value) {
  if (!isNonEmptyString(value)) return false;

  if (value.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function assertArrayOfStrings(name, value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Manifest ${name} must be a non-empty string array`);
  }

  for (const entry of value) {
    if (!isNonEmptyString(entry)) {
      throw new Error(`Manifest ${name} contains an invalid item`);
    }
  }
}

function assertPlugin(name, value) {
  if (!isObjectRecord(value)) {
    throw new Error(`Manifest plugins.${name} must be an object`);
  }

  if (!isRuntimeUrl(value.url)) {
    throw new Error(`Manifest plugins.${name}.url must be an http/https URL`);
  }

  if (!isNonEmptyString(value.integrity) || !value.integrity.startsWith("sha256-")) {
    throw new Error(`Manifest plugins.${name}.integrity must use sha256-* format`);
  }
}

function assertOptionalIntegrityBlock(name, value) {
  if (value === undefined) return;

  if (!isObjectRecord(value)) {
    throw new Error(`Manifest ${name} must be an object when provided`);
  }

  if (!isRuntimeUrl(value.url)) {
    throw new Error(`Manifest ${name}.url must be an http/https URL`);
  }

  if (value.integrity !== undefined) {
    if (!isNonEmptyString(value.integrity) || !value.integrity.startsWith("sha256-")) {
      throw new Error(`Manifest ${name}.integrity must use sha256-* format`);
    }
  }
}

export function validateManifest(manifest) {
  if (!isObjectRecord(manifest)) {
    throw new Error("Manifest payload must be an object");
  }

  if (manifest.schemaVersion !== 1) {
    throw new Error("Unsupported manifest schemaVersion");
  }

  if (!isNonEmptyString(manifest.clientId)) {
    throw new Error("Manifest clientId is required");
  }

  assertArrayOfStrings("allowedOrigins", manifest.allowedOrigins);
  assertArrayOfStrings("allowedPathRegex", manifest.allowedPathRegex);

  if (!isNonEmptyString(manifest.preferredCurrency)) {
    throw new Error("Manifest preferredCurrency is required");
  }

  if (!isObjectRecord(manifest.plugins)) {
    throw new Error("Manifest plugins block is required");
  }

  assertPlugin("pre", manifest.plugins.pre);
  assertPlugin("post", manifest.plugins.post);
  assertOptionalIntegrityBlock("settings", manifest.settings);

  if (manifest.flags !== undefined) {
    if (!isObjectRecord(manifest.flags)) {
      throw new Error("Manifest flags must be an object when provided");
    }

    if (
      manifest.flags.killSwitch !== undefined &&
      typeof manifest.flags.killSwitch !== "boolean"
    ) {
      throw new Error("Manifest flags.killSwitch must be boolean when provided");
    }
  }

  return manifest;
}

export function validateManifestEnvelope(envelope) {
  if (!isObjectRecord(envelope)) {
    throw new Error("Manifest envelope must be an object");
  }

  if (!isObjectRecord(envelope.manifest)) {
    throw new Error("Manifest envelope is missing manifest object");
  }

  if (!isNonEmptyString(envelope.signature)) {
    throw new Error("Manifest envelope is missing signature");
  }

  return envelope;
}

export async function verifyManifestEnvelope(envelope, { publicKeyPem }) {
  const normalizedEnvelope = validateManifestEnvelope(envelope);
  const manifest = validateManifest(normalizedEnvelope.manifest);
  const canonicalPayload = canonicalizeJson(manifest);
  const isValid = await verifyRsaSha256({
    canonicalPayload,
    signatureBase64: normalizedEnvelope.signature,
    publicKeyPem,
  });

  if (!isValid) {
    throw new Error("Manifest signature verification failed");
  }

  return manifest;
}

function isOriginAllowed(currentOrigin, allowedOrigins) {
  return allowedOrigins.includes(currentOrigin);
}

function isPathAllowed(pathname, regexList) {
  for (const pattern of regexList) {
    const matcher = new RegExp(pattern, "u");
    if (matcher.test(pathname)) {
      return true;
    }
  }

  return false;
}

export function isLocationAllowed(locationLike, manifest) {
  const origin = `${locationLike.protocol}//${locationLike.host}`;
  if (!isOriginAllowed(origin, manifest.allowedOrigins)) {
    return false;
  }

  return isPathAllowed(locationLike.pathname, manifest.allowedPathRegex);
}
