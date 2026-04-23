import { loadEnv } from "../dist/config/env.js";

test("loadEnv validates required numeric and enum values", () => {
  expect(() =>
    loadEnv({
      NODE_ENV: "invalid",
      CONTROL_PLANE_ENABLE_MOCK_GOOGLE: "true",
    }),
  ).toThrow(/NODE_ENV/);

  expect(() =>
    loadEnv({
      NODE_ENV: "test",
      CONTROL_PLANE_PORT: "99999",
      CONTROL_PLANE_ENABLE_MOCK_GOOGLE: "true",
    }),
  ).toThrow(/CONTROL_PLANE_PORT/);

  expect(() =>
    loadEnv({
      NODE_ENV: "test",
      CONTROL_PLANE_ENABLE_MOCK_GOOGLE: "maybe",
    }),
  ).toThrow(/CONTROL_PLANE_ENABLE_MOCK_GOOGLE/);
});

