function getSubtleCrypto() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("Web Crypto API is unavailable in this environment");
  }
  return cryptoApi.subtle;
}

function base64ToUint8Array(base64) {
  const normalized = base64.replace(/\s+/gu, "");
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }

  const decoded = atob(normalized);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes;
}

function uint8ArrayToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function utf8ToBytes(input) {
  return new TextEncoder().encode(input);
}

function pemToDerBytes(publicKeyPem) {
  const normalized = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/gu, "")
    .replace(/-----END PUBLIC KEY-----/gu, "")
    .replace(/\s+/gu, "");

  return base64ToUint8Array(normalized);
}

function constantTimeEquals(left, right) {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export async function computeSha256Base64(content) {
  const subtle = getSubtleCrypto();
  const digest = await subtle.digest("SHA-256", utf8ToBytes(content));
  return uint8ArrayToBase64(new Uint8Array(digest));
}

export async function assertSha256Integrity(content, integrity) {
  if (typeof integrity !== "string" || !integrity.startsWith("sha256-")) {
    throw new Error("Integrity metadata must use sha256-<base64> format");
  }

  const expected = integrity.slice("sha256-".length).trim();
  const computed = await computeSha256Base64(content);

  if (!constantTimeEquals(computed, expected)) {
    throw new Error("Integrity verification failed for loaded module");
  }
}

export async function verifyRsaSha256({
  canonicalPayload,
  signatureBase64,
  publicKeyPem,
}) {
  if (typeof signatureBase64 !== "string" || !signatureBase64.trim()) {
    throw new Error("Manifest signature is missing");
  }

  const subtle = getSubtleCrypto();
  const publicKey = await subtle.importKey(
    "spki",
    pemToDerBytes(publicKeyPem),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  return subtle.verify(
    {
      name: "RSASSA-PKCS1-v1_5",
    },
    publicKey,
    base64ToUint8Array(signatureBase64),
    utf8ToBytes(canonicalPayload),
  );
}
