import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalizeJson } from "../utils/json.js";
import type { RuntimeManifest, SigningService } from "../types.js";

interface ActiveKey {
  privateKeyPem: string;
  publicKeyPem: string;
  keyId: string;
  privateKeyPath: string;
  publicKeyPath: string | null;
}

function readPrivateKeyFromPath(privateKeyPath: string): string | null {
  if (!privateKeyPath) {
    return null;
  }

  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Manifest private key file not found at ${privateKeyPath}`);
  }

  return fs.readFileSync(privateKeyPath, "utf8");
}

function ensureDevKeyPair(directoryPath: string): ActiveKey {
  fs.mkdirSync(directoryPath, { recursive: true });

  const privateKeyPath = path.join(directoryPath, "manifest-dev-private.pem");
  const publicKeyPath = path.join(directoryPath, "manifest-dev-public.pem");

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    return {
      privateKeyPem: fs.readFileSync(privateKeyPath, "utf8"),
      publicKeyPem: fs.readFileSync(publicKeyPath, "utf8"),
      keyId: "dev-local-key",
      privateKeyPath,
      publicKeyPath,
    };
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const privateKeyPem = privateKey.export({
    type: "pkcs8",
    format: "pem",
  });

  const publicKeyPem = publicKey.export({
    type: "spki",
    format: "pem",
  });

  const privateKeyPemText =
    typeof privateKeyPem === "string" ? privateKeyPem : privateKeyPem.toString("utf8");
  const publicKeyPemText =
    typeof publicKeyPem === "string" ? publicKeyPem : publicKeyPem.toString("utf8");

  fs.writeFileSync(privateKeyPath, privateKeyPemText);
  fs.writeFileSync(publicKeyPath, publicKeyPemText);

  return {
    privateKeyPem: privateKeyPemText,
    publicKeyPem: publicKeyPemText,
    keyId: "dev-local-key",
    privateKeyPath,
    publicKeyPath,
  };
}

function derivePublicKeyPem(privateKeyPem: string): string {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKey = crypto.createPublicKey(privateKey);

  const publicKeyPem = publicKey.export({
    type: "spki",
    format: "pem",
  });

  return typeof publicKeyPem === "string" ? publicKeyPem : publicKeyPem.toString("utf8");
}

export function createSigningService({
  privateKeyPath,
  fallbackDirectory,
}: {
  privateKeyPath: string;
  fallbackDirectory: string;
}): SigningService {
  const configuredPrivateKey = readPrivateKeyFromPath(privateKeyPath);

  const activeKey: ActiveKey = configuredPrivateKey
    ? {
      privateKeyPem: configuredPrivateKey,
      publicKeyPem: derivePublicKeyPem(configuredPrivateKey),
      keyId: "configured-key",
      privateKeyPath,
      publicKeyPath: null,
    }
    : ensureDevKeyPair(fallbackDirectory);

  function signManifest(manifestPayload: RuntimeManifest) {
    const canonicalPayload = canonicalizeJson(manifestPayload);

    const signer = crypto.createSign("SHA256");
    signer.update(canonicalPayload);
    signer.end();

    const signature = signer.sign(activeKey.privateKeyPem).toString("base64");

    return {
      signature,
      canonicalPayload,
      keyId: activeKey.keyId,
    };
  }

  return {
    signManifest,
    getPublicKeyPem() {
      return activeKey.publicKeyPem;
    },
    getKeyMetadata() {
      return {
        keyId: activeKey.keyId,
        publicKeyPem: activeKey.publicKeyPem,
        privateKeyPath: activeKey.privateKeyPath,
        publicKeyPath: activeKey.publicKeyPath,
      };
    },
  };
}
