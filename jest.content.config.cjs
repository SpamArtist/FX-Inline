/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/apps/extension/tests/content/**/*.test.mjs"],
  transform: {},
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/apps/extension/test-dist/$1.js"
  }
};
