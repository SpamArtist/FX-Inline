#!/usr/bin/env node

import {
  DEFAULT_EXTENSION_BUILD_DIR,
  findBuildPolicyViolations,
} from "./extension-build-policy.mjs";

const buildDir = process.argv[2] ?? DEFAULT_EXTENSION_BUILD_DIR;
const violations = await findBuildPolicyViolations({ buildDir });

if (violations.length > 0) {
  console.error(`Extension build policy failed for ${buildDir}:`);

  for (const violation of violations) {
    console.error(`- [${violation.id}] ${violation.message}`);
  }

  process.exitCode = 1;
} else {
  console.log(`Extension build policy passed for ${buildDir}.`);
}
