/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/**/tests/**/*.test.mjs",
    "<rootDir>/**/test/**/*.test.mjs",
  ],
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
  testPathIgnorePatterns: ["<rootDir>/.claude/"],
  transform: {},
};
