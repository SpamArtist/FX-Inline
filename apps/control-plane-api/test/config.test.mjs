import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadEnv } from "../dist/config/env.js";

test("loadEnv validates required numeric and enum values", () => {
  expect(() =>
    loadEnv({
      NODE_ENV: "invalid",
      CONTROL_PLANE_ENABLE_MOCK_CLERK: "true",
    }),
  ).toThrow(/NODE_ENV/);

  expect(() =>
    loadEnv({
      NODE_ENV: "test",
      CONTROL_PLANE_PORT: "99999",
      CONTROL_PLANE_ENABLE_MOCK_CLERK: "true",
    }),
  ).toThrow(/CONTROL_PLANE_PORT/);

  expect(() =>
    loadEnv({
      NODE_ENV: "test",
      CONTROL_PLANE_ENABLE_MOCK_CLERK: "maybe",
    }),
  ).toThrow(/CONTROL_PLANE_ENABLE_MOCK_CLERK/);
});

test("loadEnv blocks mock Clerk in production", () => {
  expect(() =>
    loadEnv({
      NODE_ENV: "production",
      CONTROL_PLANE_ENABLE_MOCK_CLERK: "true",
    }),
  ).toThrow(/CONTROL_PLANE_ENABLE_MOCK_CLERK must be false in production/);
});

test("loadEnv requires Clerk secret when mock auth is disabled", () => {
  expect(() =>
    loadEnv({
      NODE_ENV: "test",
      CONTROL_PLANE_ENABLE_MOCK_CLERK: "false",
      CONTROL_PLANE_CLERK_SECRET_KEY: "",
    }),
  ).toThrow(/CONTROL_PLANE_CLERK_SECRET_KEY/);
});

test("loadEnv reads CONTROL_PLANE values from cwd .env", () => {
  const originalCwd = process.cwd();
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "cp-env-test-"));
  const envFilePath = path.join(tempDirectory, ".env");

  fs.writeFileSync(
    envFilePath,
    [
      "CONTROL_PLANE_ENABLE_MOCK_CLERK=true",
      "CONTROL_PLANE_PORT=8866",
      "CONTROL_PLANE_DASHBOARD_URL=http://127.0.0.1:9000",
    ].join("\n"),
    "utf8",
  );

  try {
    process.chdir(tempDirectory);

    const env = loadEnv({
      NODE_ENV: "development",
    });

    expect(env.enableMockClerk).toBe(true);
    expect(env.port).toBe(8866);
    expect(env.dashboardUrl).toBe("http://127.0.0.1:9000");
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
