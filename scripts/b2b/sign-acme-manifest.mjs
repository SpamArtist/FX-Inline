#!/usr/bin/env node
import { createHash, createSign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../..");

const privateKeyPath = process.env.FXI_MANIFEST_PRIVATE_KEY_PATH;

if (!privateKeyPath) {
  console.error("FXI_MANIFEST_PRIVATE_KEY_PATH is required");
  process.exit(1);
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nested]) => [key, normalizeValue(nested)]),
    );
  }

  return value;
}

function sha256Integrity(filePath) {
  const content = readFileSync(filePath, "utf8");
  const digest = createHash("sha256").update(content, "utf8").digest("base64");
  return `sha256-${digest}`;
}

const pluginPrePath = path.join(
  repositoryRoot,
  "apps/website/public/b2b/clients/acme/pre.v1.js",
);
const pluginPostPath = path.join(
  repositoryRoot,
  "apps/website/public/b2b/clients/acme/post.v1.js",
);
const settingsPath = path.join(
  repositoryRoot,
  "apps/website/public/b2b/settings/acme.json",
);

const manifest = {
  schemaVersion: 1,
  clientId: "acme",
  allowedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
  allowedPathRegex: ["^/b2b-demo(?:/|$)"],
  preferredCurrency: "USD",
  parserConfig: {
    extraWords: {
      credits: "USD",
    },
  },
  plugins: {
    pre: {
      url: "/b2b/clients/acme/pre.v1.js",
      integrity: sha256Integrity(pluginPrePath),
    },
    post: {
      url: "/b2b/clients/acme/post.v1.js",
      integrity: sha256Integrity(pluginPostPath),
    },
  },
  settings: {
    url: "/b2b/settings/acme.json",
    integrity: sha256Integrity(settingsPath),
  },
  uiDefaults: {
    fontScalePct: 90,
    fontWeight: 600,
    fontFamily: "inherit",
    fontColor: "#355aa8",
    spacingEm: 0.1,
  },
  flags: {
    killSwitch: false,
  },
};

const canonicalPayload = JSON.stringify(normalizeValue(manifest));
const signer = createSign("SHA256");
signer.update(canonicalPayload);
signer.end();

const signature = signer
  .sign(readFileSync(path.resolve(privateKeyPath), "utf8"))
  .toString("base64");

const signedEnvelope = {
  manifest,
  signature,
};

const outputPath = path.join(
  repositoryRoot,
  "apps/website/public/b2b/manifests/acme.signed.json",
);
writeFileSync(outputPath, `${JSON.stringify(signedEnvelope, null, 2)}\n`);

console.log(`Signed manifest written to ${outputPath}`);
