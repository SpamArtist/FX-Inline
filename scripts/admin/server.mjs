import http from "node:http";
import { URL } from "node:url";
import {
  readInlineRuntimeSettingsManifestFromDb,
  resolveAdminDbPath,
  writeInlineRuntimeSettingsManifestToDb,
} from "#admin-settings/store";

const PORT = Number(process.env.FX_INLINE_ADMIN_API_PORT || 3307);
const HOST = process.env.FX_INLINE_ADMIN_API_HOST || "127.0.0.1";
const dbPath = resolveAdminDbPath();
const MAX_BODY_BYTES = 1_000_000;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (request.method === "GET" && requestUrl.pathname === "/api/settings") {
      sendJson(response, 200, readInlineRuntimeSettingsManifestFromDb(dbPath));
      return;
    }

    if (request.method === "PUT" && requestUrl.pathname === "/api/settings") {
      const rawBody = await readRequestBody(request);
      sendJson(response, 200, {
        manifest: writeInlineRuntimeSettingsManifestToDb(JSON.parse(rawBody), dbPath),
      });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected admin API error",
    });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `FX Inline admin API listening on http://${HOST}:${PORT} using ${dbPath}\n`,
  );
});
