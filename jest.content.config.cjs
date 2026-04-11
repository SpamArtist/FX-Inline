/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/apps/extension/tests/content/**/*.test.mjs"],
  transform: {
    "^.+\\.[cm]?js$": "<rootDir>/apps/extension/tests/content/jest-content-transformer.cjs",
  },
  moduleNameMapper: {
    "^@/(.*)\\.json$": "<rootDir>/apps/extension/test-dist/$1.json",
    "^@/(.*)$": "<rootDir>/apps/extension/test-dist/$1.js",
    "\\.(css)$": "<rootDir>/apps/extension/tests/content/style-mock.cjs",
  }
};
