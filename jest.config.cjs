/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/**/tests/**/*.test.mjs",
    "<rootDir>/**/test/**/*.test.mjs",
  ],
  transform: {},
};
