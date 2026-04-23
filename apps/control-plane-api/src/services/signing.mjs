import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalizeJson } from "../utils/json.mjs";

function readPrivateKeyFromPath(privateKeyPath) {
  if (!privateKeyPath) {
    return null;
  }

  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Manifest private key file not found at ${privateKeyPath}`);
  }

  return fs.readFileSync(privateKeyPath, "utf8");
}

function ensureDevKeyPair(directoryPath) {
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

  fs.writeFileSync(privateKeyPath, privateKeyPem);
  fs.writeFileSync(publicKeyPath, publicKeyPem);

  return {
    privateKeyPem,
    publicKeyPem,
    keyId: "dev-local-key",
    privateKeyPath,
    publicKeyPath,
  };
}

function derivePublicKeyPem(privateKeyPem) {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKey = crypto.createPublicKey(privateKey);

  return publicKey.export({
    type: "spki",
    format: "pem",
  });
}

export function createSigningService({ privateKeyPath, fallbackDirectory }) {
  const configuredPrivateKey = readPrivateKeyFromPath(privateKeyPath);

  const activeKey = configuredPrivateKey
    ? {
      privateKeyPem: configuredPrivateKey,
      publicKeyPem: derivePublicKeyPem(configuredPrivateKey),
      keyId: "configured-key",
      privateKeyPath,
      publicKeyPath: null,
    }
    : ensureDevKeyPair(fallbackDirectory);

  function signManifest(manifestPayload) {
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
