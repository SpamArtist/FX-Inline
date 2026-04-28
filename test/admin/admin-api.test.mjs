import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDefaultInlineRuntimeSettingsManifest } from "../../dist/backend/settings-store.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const generatedManifestPath = path.join(
  repoRoot,
  "apps/extension/generated/inlineRuntimeSettingsManifest.ts",
);

function readGeneratedManifestSource() {
  return fs.existsSync(generatedManifestPath)
    ? fs.readFileSync(generatedManifestPath, "utf8")
    : null;
}

function getOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Unable to allocate a local test port."));
          return;
        }

        resolve(address.port);
      });
    });
  });
}

function startAdminProcess(args, env) {
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  return {
    child,
    getOutput: () => output,
  };
}

async function stopAdminProcess(child) {
  if (child.exitCode !== null) return;

  child.kill();
  await Promise.race([
    once(child, "exit"),
    delay(1_000).then(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }),
  ]);
}

async function waitForAdminApi(baseUrl, getOutput) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/settings`);
      if (response.ok) return;
    } catch {
      await delay(100);
      continue;
    }
    await delay(100);
  }

  throw new Error(`Admin API did not start. Output:\n${getOutput()}`);
}

async function assertBuildEndpointDisabled({
  args,
  expectedStatus,
  name,
  testContext,
}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fx-inline-admin-api-"));
  const port = await getOpenPort();
  const dbPath = path.join(tempDir, "settings.sqlite");
  const baseUrl = `http://127.0.0.1:${port}`;
  const beforeGeneratedManifest = readGeneratedManifestSource();
  const { child, getOutput } = startAdminProcess(args, {
    FX_INLINE_ADMIN_API_HOST: "127.0.0.1",
    FX_INLINE_ADMIN_API_PORT: String(port),
    FX_INLINE_ADMIN_DB_PATH: dbPath,
  });

  testContext.after(async () => {
    await stopAdminProcess(child);
  });

  await waitForAdminApi(baseUrl, getOutput);

  const saveResponse = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createDefaultInlineRuntimeSettingsManifest()),
  });
  assert.equal(saveResponse.status, 200, name);
  const savePayload = await saveResponse.json();
  assert.equal(Object.hasOwn(savePayload, "outputPath"), false, name);
  assert.equal(readGeneratedManifestSource(), beforeGeneratedManifest, name);

  const buildResponse = await fetch(`${baseUrl}/api/build-extension`, {
    method: "POST",
  });
  assert.equal(buildResponse.status, expectedStatus, name);
}

test("Nest admin API does not expose the HTTP build endpoint", async (t) => {
  await assertBuildEndpointDisabled({
    args: ["dist/backend/main.js"],
    expectedStatus: 404,
    name: "nest admin api",
    testContext: t,
  });
});

test("legacy admin HTTP server does not expose the HTTP build endpoint", async (t) => {
  await assertBuildEndpointDisabled({
    args: ["scripts/admin/server.mjs"],
    expectedStatus: 404,
    name: "legacy admin server",
    testContext: t,
  });
});
