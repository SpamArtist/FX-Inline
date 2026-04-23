export const PRE_PLUGIN_FORBIDDEN_TOKENS = [
  "fetch(",
  "XMLHttpRequest",
  "setTimeout(",
  "setInterval(",
  "Math.random(",
  "Date.now(",
  "performance.now(",
  "navigator.sendBeacon(",
];

export function assertDeterministicPrePluginSource(sourceCode, options = {}) {
  const text = typeof sourceCode === "string" ? sourceCode : "";
  const forbiddenTokens = options.forbiddenTokens || PRE_PLUGIN_FORBIDDEN_TOKENS;
  const findings = [];

  for (const token of forbiddenTokens) {
    if (!text.includes(token)) {
      continue;
    }

    findings.push({
      token,
      reason: "Forbidden nondeterministic or side-effect token",
    });
  }

  return {
    valid: findings.length === 0,
    findings,
  };
}
