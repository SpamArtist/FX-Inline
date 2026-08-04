import { createCurrencyParser } from "./parser-core.js";

export { createCurrencyParser };

const defaultParser = createCurrencyParser();

export function __clearDefaultParserCachesForTests() {
  defaultParser.__clearCachesForTests?.();
}

export function parseCurrencyValue(input, options) {
  return defaultParser.parseValue(input, options);
}

export function extractCurrencyTextMatches(input, options) {
  return defaultParser.extractMatches(input, options);
}

export function mayContainCurrencyToken(input) {
  return defaultParser.mayContainCurrencyToken(input);
}

export function hasThousandMagnitudeHint(input) {
  return defaultParser.hasThousandMagnitudeHint(input);
}
