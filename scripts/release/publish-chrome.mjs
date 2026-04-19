import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getArtifactNames,
  resolveReleaseTagFromEnvironment,
} from "./versioning.mjs";

const release = resolveReleaseTagFromEnvironment();

if (release.channel !== "final") {
  throw new Error("Chrome publishing is only supported for final releases.");
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function getChromeAccessToken(serviceAccountJson) {
  const serviceAccount = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/chromewebstore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsignedJwt = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claimSet))}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedJwt)
    .end()
    .sign(serviceAccount.private_key)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(
      `Failed to obtain Chrome access token: ${tokenResponse.status} ${await tokenResponse.text()}`,
    );
  }

  const tokenPayload = await tokenResponse.json();
  if (!tokenPayload.access_token) {
    throw new Error("Chrome access token response did not include access_token.");
  }

  return tokenPayload.access_token;
}

async function requestChrome(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Chrome API request failed: ${response.status} ${await response.text()}`);
  }

  return response;
}

async function fetchChromeStatus(accessToken, publisherId, extensionId) {
  const response = await requestChrome(
    accessToken,
    `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:fetchStatus`,
  );
  return response.json();
}

async function pollUploadStatus(accessToken, publisherId, extensionId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await fetchChromeStatus(accessToken, publisherId, extensionId);
    const uploadState = status.lastAsyncUploadState ?? "UPLOAD_STATE_UNSPECIFIED";

    if (uploadState === "SUCCEEDED" || uploadState === "NOT_FOUND") {
      return status;
    }

    if (uploadState === "FAILED") {
      throw new Error(`Chrome upload failed: ${JSON.stringify(status)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Timed out while waiting for Chrome upload status to settle.");
}

const publisherId = requireEnv("CWS_PUBLISHER_ID");
const extensionId = requireEnv("CWS_EXTENSION_ID");
const serviceAccountJson = requireEnv("CWS_SERVICE_ACCOUNT_JSON");
const releaseAssetDirectory = process.env.RELEASE_ASSET_DIR ?? ".release";
const chromeZipPath = path.join(
  releaseAssetDirectory,
  getArtifactNames(release).chromeZip,
);

const zipBuffer = await fs.readFile(chromeZipPath);
const accessToken = await getChromeAccessToken(serviceAccountJson);

await requestChrome(
  accessToken,
  `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisherId}/items/${extensionId}:upload`,
  {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: zipBuffer,
  },
);

const uploadStatus = await pollUploadStatus(accessToken, publisherId, extensionId);

await requestChrome(
  accessToken,
  `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:publish`,
  { method: "POST" },
);

const finalStatus = await fetchChromeStatus(accessToken, publisherId, extensionId);
process.stdout.write(
  `${JSON.stringify(
    {
      uploadState: uploadStatus.lastAsyncUploadState ?? null,
      submittedState: finalStatus.submittedItemRevisionStatus?.state ?? null,
      publishedState: finalStatus.publishedItemRevisionStatus?.state ?? null,
    },
    null,
    2,
  )}\n`,
);
