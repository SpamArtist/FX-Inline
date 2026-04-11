module.exports = {
  process(sourceText, sourcePath) {
    if (!sourcePath.includes("/apps/extension/test-dist/")) {
      return { code: sourceText };
    }

    return {
      code: sourceText.replace(/import\.meta\.env\.DEV/g, "false"),
    };
  },
};
