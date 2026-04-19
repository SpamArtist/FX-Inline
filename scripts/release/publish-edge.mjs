import fs from "node:fs/promises";
import path from "node:path";
import {
  getArtifactNames,
  resolveReleaseTagFromEnvironment,
} from "./versioning.mjs";

const release = resolveReleaseTagFromEnvironment();

if (release.channel !== "final") {
  throw new Error("Edge publishing is only supported for final releases.");
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function edgeRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Edge API request failed: ${response.status} ${await response.text()}`);
  }
  return response;
}

async function pollOperation(headers, productId, operationId, kind) {
  const endpoint =
    kind === "publish"
      ? `https://api.addons.microsoftedge.microsoft.com/v1/products/${productId}/submissions/operations/${operationId}`
      : `https://api.addons.microsoftedge.microsoft.com/v1/products/${productId}/submissions/draft/package/operations/${operationId}`;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await edgeRequest(endpoint, {
      method: "GET",
      headers,
    });
    const payload = await response.json();

    if (payload.status === "Succeeded") {
      return payload;
    }

    if (payload.status === "Failed") {
      throw new Error(`${kind} failed: ${JSON.stringify(payload)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error(`Timed out while waiting for Edge ${kind} to complete.`);
}

const clientId = requireEnv("EDGE_CLIENT_ID");
const apiKey = requireEnv("EDGE_API_KEY");
const productId = requireEnv("EDGE_PRODUCT_ID");
const publishNotes =
  process.env.EDGE_PUBLISH_NOTES ?? `Automated release ${release.displayVersion}`;
const releaseAssetDirectory = process.env.RELEASE_ASSET_DIR ?? ".release";
const chromeZipPath = path.join(
  releaseAssetDirectory,
  getArtifactNames(release).chromeZip,
);

const zipBuffer = await fs.readFile(chromeZipPath);
const headers = {
  Authorization: `ApiKey ${apiKey}`,
  "X-ClientID": clientId,
};

const uploadResponse = await edgeRequest(
  `https://api.addons.microsoftedge.microsoft.com/v1/products/${productId}/submissions/draft/package`,
  {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/zip",
    },
    body: zipBuffer,
  },
);

const uploadLocation = uploadResponse.headers.get("location");
if (!uploadLocation) {
  throw new Error("Edge upload response did not include a Location header.");
}

const uploadOperationId = uploadLocation.split("/").at(-1);
const uploadStatus = await pollOperation(headers, productId, uploadOperationId, "upload");

const publishResponse = await edgeRequest(
  `https://api.addons.microsoftedge.microsoft.com/v1/products/${productId}/submissions`,
  {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ notes: publishNotes }),
  },
);

const publishLocation = publishResponse.headers.get("location");
if (!publishLocation) {
  throw new Error("Edge publish response did not include a Location header.");
}

const publishOperationId = publishLocation.split("/").at(-1);
const publishStatus = await pollOperation(headers, productId, publishOperationId, "publish");

process.stdout.write(
  `${JSON.stringify(
    {
      uploadStatus: uploadStatus.status,
      uploadMessage: uploadStatus.message ?? null,
      publishStatus: publishStatus.status,
      publishMessage: publishStatus.message ?? null,
    },
    null,
    2,
  )}\n`,
);
