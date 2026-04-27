import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import {
  readInlineRuntimeSettingsManifestFromDb,
  resolveAdminDbPath,
  saveAndExportInlineRuntimeSettingsManifest,
} from "./settings-store.mjs";

const PORT = Number(process.env.FX_INLINE_ADMIN_API_PORT || 3307);
const HOST = process.env.FX_INLINE_ADMIN_API_HOST || "127.0.0.1";
const dbPath = resolveAdminDbPath();
const MAX_BODY_BYTES = 1_000_000;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDirectory, "../..");

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        FORCE_COLOR: "0",
      },
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`Command failed with exit code ${exitCode}.`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function buildWebExtension() {
  return runCommand("npm", ["run", "build"], { cwd: repoRoot });
}

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
      sendJson(
        response,
        200,
        saveAndExportInlineRuntimeSettingsManifest(JSON.parse(rawBody), { dbPath }),
      );
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/build-extension") {
      const { stdout, stderr } = await buildWebExtension();
      sendJson(response, 200, { stdout, stderr });
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
