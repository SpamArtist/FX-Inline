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
