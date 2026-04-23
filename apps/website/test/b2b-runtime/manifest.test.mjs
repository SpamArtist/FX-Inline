import { createSign, generateKeyPairSync } from "node:crypto";
import { canonicalizeJson } from "../../b2b-runtime/canonicalize.js";
import {
  isLocationAllowed,
  validateManifest,
  verifyManifestEnvelope,
} from "../../b2b-runtime/manifest.js";

function createSignedEnvelope(manifest) {
  const canonicalPayload = canonicalizeJson(manifest);
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const signer = createSign("SHA256");
  signer.update(canonicalPayload);
  signer.end();

  return {
    envelope: {
      manifest,
      signature: signer.sign(privateKey).toString("base64"),
    },
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
  };
}

function getBaseManifest() {
  return {
    schemaVersion: 1,
    clientId: "acme",
    allowedOrigins: ["http://localhost:5173"],
    allowedPathRegex: ["^/b2b-demo(?:/|$)"],
    preferredCurrency: "USD",
    plugins: {
      pre: {
        url: "/b2b/clients/acme/pre.v1.js",
        integrity: "sha256-a",
      },
      post: {
        url: "/b2b/clients/acme/post.v1.js",
        integrity: "sha256-b",
      },
    },
  };
}

test("validateManifest accepts same-origin runtime asset URLs", () => {
  const manifest = getBaseManifest();
  expect(validateManifest(manifest)).toEqual(manifest);
});

test("verifyManifestEnvelope validates signature", async () => {
  const manifest = getBaseManifest();
  const { envelope, publicKeyPem } = createSignedEnvelope(manifest);

  await expect(
    verifyManifestEnvelope(envelope, { publicKeyPem }),
  ).resolves.toEqual(manifest);

  const tampered = {
    ...envelope,
    manifest: {
      ...envelope.manifest,
      preferredCurrency: "EUR",
    },
  };

  await expect(
    verifyManifestEnvelope(tampered, { publicKeyPem }),
  ).rejects.toThrow(/signature verification failed/i);
});

test("isLocationAllowed enforces host and path allowlists", () => {
  const manifest = getBaseManifest();

  expect(
    isLocationAllowed(
      {
        protocol: "http:",
        host: "localhost:5173",
        pathname: "/b2b-demo",
      },
      manifest,
    ),
  ).toBe(true);

  expect(
    isLocationAllowed(
      {
        protocol: "http:",
        host: "localhost:5173",
        pathname: "/other-page",
      },
      manifest,
    ),
  ).toBe(false);

  expect(
    isLocationAllowed(
      {
        protocol: "https:",
        host: "evil.example",
        pathname: "/b2b-demo",
      },
      manifest,
    ),
  ).toBe(false);
});
