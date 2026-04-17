import {
  DEFAULT_ALLOWED_CURRENCY_CODES,
  DEFAULT_CURRENCY_SYMBOLS,
  DEFAULT_CURRENCY_SYMBOL_VARIANT_HINTS,
  DEFAULT_ISO_CODES,
  DEFAULT_SYMBOL_TO_CODE,
  DEFAULT_WORD_LIKE_ISO_CODES,
  DEFAULT_WORD_TO_CODE,
} from "./data.js";
import { createMagnitudeAliasResolver } from "./magnitude-profiles.js";

const groupingSpaceRegex = /[\u00A0\u202F ]/gu;
const unicodeLetterRegex = /\p{L}/u;
const usernameWordCharacterRegex = /[\p{L}\p{N}_]/u;
const unicodeWhitespaceRegex = /\s/u;
const quickDigitRegex = /\d/u;
const thousandMagnitudeHintRegex =
  /\d[\d,.\u00A0\u202F ]*\s*[kK](?=$|[^\p{L}\p{N}])/u;

function assertObjectOrUndefined(value, fieldName) {
  if (value == null) return;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
}

function normalizeCurrencyCode(code, fieldName) {
  if (typeof code !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmed = code.trim();
  const upper = trimmed.toUpperCase();

  if (!/^[A-Z]{3,4}$/.test(upper) || trimmed !== upper) {
    throw new Error(`${fieldName} must be uppercase ISO-like code (3-4 letters).`);
  }

  return upper;
}

function normalizeLocaleCacheKey(localeHint) {
  return localeHint?.trim().toLowerCase() || "__all__";
}

function normalizeMagnitudeAlias(input) {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTrailingPlus(input) {
  return input.replace(/\s*\+\s*$/u, "").trim();
}

function resolveLocaleHint(options) {
  if (typeof options === "string") return options || null;
  return options?.localeHint || null;
}

function isUsernameWordCharacter(input) {
  return input.length > 0 && usernameWordCharacterRegex.test(input);
}

function shouldSkipLikelyUsernameCurrencyMatch(input, start, end) {
  let trimmedStart = start;
  let trimmedEnd = end;

  while (
    trimmedStart < trimmedEnd &&
    unicodeWhitespaceRegex.test(input[trimmedStart] || "")
  ) {
    trimmedStart += 1;
  }

  while (
    trimmedEnd > trimmedStart &&
    unicodeWhitespaceRegex.test(input[trimmedEnd - 1] || "")
  ) {
    trimmedEnd -= 1;
  }

  const before = trimmedStart > 0 ? input[trimmedStart - 1] : "";
  const after = trimmedEnd < input.length ? input[trimmedEnd] : "";

  if (before === "@" || before === "＠") {
    return true;
  }

  return isUsernameWordCharacter(before) || isUsernameWordCharacter(after);
}

function parseFlexibleNumber(str, start, end) {
  let i = start;
  if (i >= end) return null;

  let sign = 1;

  const first = str.charCodeAt(i);
  if (first === 43) i += 1;
  else if (first === 45) {
    sign = -1;
    i += 1;
  }

  let integerPart = "";
  let decimalPart = "";

  let seenDot = false;
  let seenComma = false;
  let commaCount = 0;

  for (; i < end; i += 1) {
    const c = str.charCodeAt(i);

    if (c >= 48 && c <= 57) {
      if (!seenDot) integerPart += str[i];
      else decimalPart += str[i];
      continue;
    }

    if (c === 32 || c === 160 || c === 8239) {
      const previousCode = i > start ? str.charCodeAt(i - 1) : null;
      const nextCode = i + 1 < end ? str.charCodeAt(i + 1) : null;
      const surroundedByDigits =
        previousCode !== null &&
        nextCode !== null &&
        previousCode >= 48 &&
        previousCode <= 57 &&
        nextCode >= 48 &&
        nextCode <= 57;

      if (seenDot || !surroundedByDigits) {
        return null;
      }

      continue;
    }

    if (c === 46) {
      if (seenDot) return null;
      seenDot = true;
      continue;
    }

    if (c === 44) {
      const previousCode = i > start ? str.charCodeAt(i - 1) : null;
      const nextCode = i + 1 < end ? str.charCodeAt(i + 1) : null;
      const surroundedByDigits =
        previousCode !== null &&
        nextCode !== null &&
        previousCode >= 48 &&
        previousCode <= 57 &&
        nextCode >= 48 &&
        nextCode <= 57;

      if (seenDot || !surroundedByDigits) {
        return null;
      }

      seenComma = true;
      commaCount += 1;
      continue;
    }

    return null;
  }

  if (!integerPart.length) return null;

  if (!seenDot && seenComma && commaCount === 1) {
    const raw = str.slice(start, end);
    const lastComma = raw.lastIndexOf(",");
    const decimalText = raw.slice(lastComma + 1).replace(groupingSpaceRegex, "");
    const digitsAfter = decimalText.length;

    if (digitsAfter > 0 && digitsAfter <= 2) {
      const normalizedDecimalRaw = raw
        .replace(groupingSpaceRegex, "")
        .replace(",", ".");
      const num = Number(normalizedDecimalRaw);
      return Number.isFinite(num) ? sign * num : null;
    }
  }

  const normalized = integerPart + (decimalPart ? `.${decimalPart}` : "");
  const num = Number(normalized);

  return Number.isFinite(num) ? sign * num : null;
}

function createCompiledConfig(config) {
  const normalizedConfig = config ?? {};
  if (typeof normalizedConfig !== "object" || Array.isArray(normalizedConfig)) {
    throw new Error("Parser config must be an object.");
  }

  const allowedCurrencyCodes = new Set(DEFAULT_ALLOWED_CURRENCY_CODES);
  const isoCodes = new Set(DEFAULT_ISO_CODES);
  const currencySymbols = new Set(DEFAULT_CURRENCY_SYMBOLS);
  const symbolToCode = new Map(DEFAULT_SYMBOL_TO_CODE);
  const wordToCode = new Map(DEFAULT_WORD_TO_CODE);

  const extraIsoCodes = normalizedConfig.extraIsoCodes ?? [];
  if (!Array.isArray(extraIsoCodes)) {
    throw new Error("extraIsoCodes must be an array.");
  }

  if (extraIsoCodes.length > 500) {
    throw new Error("extraIsoCodes exceeds safety limit.");
  }

  for (const code of extraIsoCodes) {
    const normalizedCode = normalizeCurrencyCode(code, "extraIsoCodes[]");
    isoCodes.add(normalizedCode);
    allowedCurrencyCodes.add(normalizedCode);
  }

  assertObjectOrUndefined(normalizedConfig.extraSymbols, "extraSymbols");
  const extraSymbols = normalizedConfig.extraSymbols ?? {};
  for (const [symbolToken, currencyCodeInput] of Object.entries(extraSymbols)) {
    if (!symbolToken.trim().length) {
      throw new Error("extraSymbols keys must be non-empty.");
    }

    const normalizedCode = normalizeCurrencyCode(
      currencyCodeInput,
      `extraSymbols[${symbolToken}]`,
    );

    const canonicalSymbol = symbolToken.normalize("NFKC");
    if (symbolToCode.has(symbolToken) || currencySymbols.has(symbolToken)) {
      throw new Error(`extraSymbols cannot override existing token: ${symbolToken}`);
    }

    if (
      canonicalSymbol !== symbolToken &&
      (symbolToCode.has(canonicalSymbol) || currencySymbols.has(canonicalSymbol))
    ) {
      throw new Error(
        `extraSymbols collides with existing canonical token: ${symbolToken}`,
      );
    }

    currencySymbols.add(symbolToken);
    symbolToCode.set(symbolToken, normalizedCode);
    allowedCurrencyCodes.add(normalizedCode);
  }

  assertObjectOrUndefined(normalizedConfig.extraWords, "extraWords");
  const extraWords = normalizedConfig.extraWords ?? {};
  for (const [wordTokenRaw, currencyCodeInput] of Object.entries(extraWords)) {
    if (!wordTokenRaw.trim().length) {
      throw new Error("extraWords keys must be non-empty.");
    }

    const wordToken = wordTokenRaw.toLowerCase();
    const normalizedCode = normalizeCurrencyCode(
      currencyCodeInput,
      `extraWords[${wordTokenRaw}]`,
    );

    if (wordToCode.has(wordToken)) {
      throw new Error(`extraWords cannot override existing token: ${wordTokenRaw}`);
    }

    wordToCode.set(wordToken, normalizedCode);
    allowedCurrencyCodes.add(normalizedCode);
  }

  const getMagnitudeAliasMap = createMagnitudeAliasResolver(
    normalizedConfig.extraMagnitudeProfiles,
  );

  function toCurrencyCode(value) {
    return allowedCurrencyCodes.has(value) ? value : null;
  }

  function normalizeCurrencySymbolToken(token) {
    return token.normalize("NFKC");
  }

  function getCanonicalCurrencySymbolToken(token) {
    if (!token.length) return null;
    if (currencySymbols.has(token)) return token;

    const normalizedToken = normalizeCurrencySymbolToken(token);
    if (currencySymbols.has(normalizedToken)) {
      return normalizedToken;
    }

    return null;
  }

  const recognizedCurrencySymbols = new Set(Array.from(currencySymbols));
  for (const symbolVariant of DEFAULT_CURRENCY_SYMBOL_VARIANT_HINTS) {
    const canonicalSymbol = getCanonicalCurrencySymbolToken(symbolVariant);
    if (!canonicalSymbol) continue;

    recognizedCurrencySymbols.add(symbolVariant);
    recognizedCurrencySymbols.add(canonicalSymbol);
  }

  const wordLikeIsoCodes = new Set(
    Array.from(DEFAULT_WORD_LIKE_ISO_CODES).filter((code) => toCurrencyCode(code)),
  );

  const currencyTokens = [
    ...Array.from(isoCodes).map((token) => ({
      token,
      kind: "iso",
    })),
    ...Array.from(recognizedCurrencySymbols).map((token) => ({
      token,
      kind: "symbol",
    })),
    ...Array.from(wordToCode.keys()).map((token) => ({
      token,
      kind: "word",
    })),
  ].sort((a, b) => b.token.length - a.token.length);

  const symbolPattern = Array.from(recognizedCurrencySymbols)
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join("|");

  const isoPattern = Array.from(isoCodes)
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join("|");

  const wordPattern = Array.from(wordToCode.keys())
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join("|");

  const isoTokenPattern = `(?<!\\p{L})(?:${isoPattern})(?!\\p{L})`;
  const wordTokenPattern = `(?<!\\p{L})(?:${wordPattern})(?!\\p{L})`;
  const quickCurrencyTokenRegex = new RegExp(
    `(?:${isoTokenPattern}|${symbolPattern}|${wordTokenPattern})`,
    "iu",
  );

  const parserArtifactsCache = new Map();
  const wordLikeCurrencyTokenRegexCache = new Map();

  function getWordLikeCurrencyTokenRegex(currency) {
    const cached = wordLikeCurrencyTokenRegexCache.get(currency);
    if (cached) return cached;

    const regex = new RegExp(
      `(?<!\\p{L})${escapeRegex(currency)}(?!\\p{L})`,
      "iu",
    );
    wordLikeCurrencyTokenRegexCache.set(currency, regex);
    return regex;
  }

  function shouldSkipWordLikeCurrencyByCasing(raw, currency) {
    if (!wordLikeIsoCodes.has(currency)) return false;

    const tokenRegex = getWordLikeCurrencyTokenRegex(currency);
    const matchedToken = raw.match(tokenRegex)?.[0];
    if (!matchedToken) return false;

    return matchedToken !== currency;
  }

  function isCurrencyToken(token) {
    const upper = token.toUpperCase();

    if (isoCodes.has(upper)) {
      return toCurrencyCode(upper);
    }

    const canonicalSymbol = getCanonicalCurrencySymbolToken(token);
    if (canonicalSymbol) {
      const mappedCode = symbolToCode.get(canonicalSymbol);
      return mappedCode ? toCurrencyCode(mappedCode) : null;
    }

    const mappedCode = wordToCode.get(token.toLowerCase());
    if (mappedCode) {
      return toCurrencyCode(mappedCode);
    }

    return null;
  }

  function parseNumberWithOptionalMagnitudeForArtifacts(input, artifacts) {
    const trimmed = stripTrailingPlus(input);
    if (!trimmed.length) return null;

    const magnitudeMatch = trimmed.match(artifacts.magnitudeSuffixRegex);

    if (!magnitudeMatch) {
      return parseFlexibleNumber(trimmed, 0, trimmed.length);
    }

    const numberText = magnitudeMatch[1].trim();
    const normalizedMagnitude = normalizeMagnitudeAlias(magnitudeMatch[2]);
    if (!numberText.length) return null;

    const baseValue = parseFlexibleNumber(numberText, 0, numberText.length);
    if (baseValue === null) return null;

    const multiplier = artifacts.magnitudeMultiplierByAlias.get(normalizedMagnitude);
    if (multiplier === undefined) return null;

    return baseValue * multiplier;
  }

  function parseWithTokenForArtifacts(input, artifacts, position) {
    const upperInput = input.toUpperCase();
    const lowerInput = input.toLowerCase();

    for (const tokenInfo of currencyTokens) {
      let hasToken = false;

      if (tokenInfo.kind === "iso") {
        hasToken = position === "prefix"
          ? upperInput.startsWith(tokenInfo.token)
          : upperInput.endsWith(tokenInfo.token);
      } else if (tokenInfo.kind === "symbol") {
        hasToken = position === "prefix"
          ? input.startsWith(tokenInfo.token)
          : input.endsWith(tokenInfo.token);
      } else if (position === "prefix") {
        hasToken =
          lowerInput.startsWith(tokenInfo.token) &&
          !unicodeLetterRegex.test(input[tokenInfo.token.length] || "");
      } else {
        const tokenStart = input.length - tokenInfo.token.length;
        hasToken =
          lowerInput.endsWith(tokenInfo.token) &&
          !unicodeLetterRegex.test(input[tokenStart - 1] || "");
      }

      if (!hasToken) continue;

      const parsedCurrency = isCurrencyToken(tokenInfo.token);
      if (!parsedCurrency) continue;

      const valueText =
        position === "prefix"
          ? input.slice(tokenInfo.token.length).trim()
          : input.slice(0, input.length - tokenInfo.token.length).trim();
      if (!valueText.length) continue;

      const value = parseNumberWithOptionalMagnitudeForArtifacts(valueText, artifacts);
      if (value !== null) {
        return {
          value,
          currency: parsedCurrency,
        };
      }
    }

    return null;
  }

  function buildParserArtifacts(localeHint) {
    const magnitudeMultiplierByAlias = getMagnitudeAliasMap(localeHint);
    const magnitudePattern = Array.from(magnitudeMultiplierByAlias.keys())
      .map((alias) => escapeRegex(alias).replace(/\s+/g, "\\s+"))
      .sort((a, b) => b.length - a.length)
      .join("|");

    const magnitudeTokenPattern = `(?:${magnitudePattern})(?=$|[^\\p{L}\\p{N}])`;
    const numberWithOptionalMagnitudePattern =
      `[+-]?\\d[\\d,.\\u00A0\\u202F ]*(?:\\s*${magnitudeTokenPattern})?(?:\\s*\\+)?`;
    const boundedNumberWithOptionalMagnitudePattern =
      `(?<![\\p{N}\\-–—])${numberWithOptionalMagnitudePattern}`;
    const currencyTokenPattern =
      `(${isoTokenPattern}|(?:${symbolPattern})|${wordTokenPattern})`;
    const rangeSeparatorPattern = "(?:-|–|—)";

    const currencySnippetRegex = new RegExp(
      `(?:${isoTokenPattern}\\s*${numberWithOptionalMagnitudePattern}|${boundedNumberWithOptionalMagnitudePattern}\\s*${isoTokenPattern}|(?:${symbolPattern})\\s*${numberWithOptionalMagnitudePattern}|${boundedNumberWithOptionalMagnitudePattern}\\s*(?:${symbolPattern})|${wordTokenPattern}\\s*${numberWithOptionalMagnitudePattern}|${boundedNumberWithOptionalMagnitudePattern}\\s*${wordTokenPattern})`,
      "giu",
    );

    const currencyRangeRegex = new RegExp(
      `${currencyTokenPattern}\\s*(${numberWithOptionalMagnitudePattern})\\s*${rangeSeparatorPattern}\\s*(${numberWithOptionalMagnitudePattern})`,
      "giu",
    );

    const magnitudeSuffixRegex = new RegExp(`^(.+?)\\s*(${magnitudePattern})$`, "iu");

    return {
      magnitudeMultiplierByAlias,
      magnitudeSuffixRegex,
      currencySnippetRegex,
      currencyRangeRegex,
    };
  }

  function getParserArtifacts(localeHint) {
    const cacheKey = normalizeLocaleCacheKey(localeHint);
    const cached = parserArtifactsCache.get(cacheKey);
    if (cached) return cached;

    const artifacts = buildParserArtifacts(localeHint);
    parserArtifactsCache.set(cacheKey, artifacts);
    return artifacts;
  }

  function parseCurrencyValueWithArtifacts(input, artifacts) {
    if (input == null) return { valid: false };

    const str = String(input).trim();
    if (!str.length) return { valid: false };

    const numericOnly = parseNumberWithOptionalMagnitudeForArtifacts(str, artifacts);
    if (numericOnly !== null) {
      return { valid: true, value: numericOnly, currency: null };
    }

    const prefix = parseWithTokenForArtifacts(str, artifacts, "prefix");
    if (prefix) {
      return {
        valid: true,
        value: prefix.value,
        currency: prefix.currency,
      };
    }

    const suffix = parseWithTokenForArtifacts(str, artifacts, "suffix");
    if (suffix) {
      return {
        valid: true,
        value: suffix.value,
        currency: suffix.currency,
      };
    }

    return { valid: false };
  }

  function parseValue(input, options) {
    const localeHint = resolveLocaleHint(options);
    const artifacts = getParserArtifacts(localeHint);
    return parseCurrencyValueWithArtifacts(input, artifacts);
  }

  function extractMatches(input, options) {
    if (!input?.length) return [];

    const localeHint = resolveLocaleHint(options);
    const artifacts = getParserArtifacts(localeHint);

    artifacts.currencySnippetRegex.lastIndex = 0;
    artifacts.currencyRangeRegex.lastIndex = 0;

    const matches = [];

    for (const candidate of input.matchAll(artifacts.currencySnippetRegex)) {
      if (candidate.index === undefined) continue;

      const raw = candidate[0];
      const parsed = parseCurrencyValueWithArtifacts(raw, artifacts);

      if (!parsed.valid || parsed.currency == null || parsed.value === undefined) {
        continue;
      }

      if (shouldSkipWordLikeCurrencyByCasing(raw, parsed.currency)) {
        continue;
      }

      if (
        shouldSkipLikelyUsernameCurrencyMatch(
          input,
          candidate.index,
          candidate.index + raw.length,
        )
      ) {
        continue;
      }

      matches.push({
        raw,
        start: candidate.index,
        end: candidate.index + raw.length,
        value: parsed.value,
        currency: parsed.currency,
      });
    }

    for (const candidate of input.matchAll(artifacts.currencyRangeRegex)) {
      if (candidate.index === undefined) continue;

      const raw = candidate[0];
      if (
        shouldSkipLikelyUsernameCurrencyMatch(
          input,
          candidate.index,
          candidate.index + raw.length,
        )
      ) {
        continue;
      }

      const parsedCurrency = isCurrencyToken(candidate[1]);
      if (!parsedCurrency) continue;
      if (shouldSkipWordLikeCurrencyByCasing(candidate[1], parsedCurrency)) {
        continue;
      }

      const firstValueText = candidate[2];
      const secondValueText = candidate[3];
      if (!firstValueText || !secondValueText) continue;

      const normalizedFirstValueText = stripTrailingPlus(firstValueText);
      const normalizedSecondValueText = stripTrailingPlus(secondValueText);

      const firstHadMagnitude =
        artifacts.magnitudeSuffixRegex.test(normalizedFirstValueText);
      const secondHadMagnitude =
        artifacts.magnitudeSuffixRegex.test(normalizedSecondValueText);

      let firstValue = parseNumberWithOptionalMagnitudeForArtifacts(
        firstValueText,
        artifacts,
      );
      let secondValue = parseNumberWithOptionalMagnitudeForArtifacts(
        secondValueText,
        artifacts,
      );

      if (firstValue === null || secondValue === null) {
        continue;
      }

      if (!firstHadMagnitude && secondHadMagnitude) {
        const secondMagnitude = normalizedSecondValueText.match(
          artifacts.magnitudeSuffixRegex,
        );
        if (secondMagnitude) {
          const alias = normalizeMagnitudeAlias(secondMagnitude[2]);
          const multiplier = artifacts.magnitudeMultiplierByAlias.get(alias);
          if (multiplier !== undefined) {
            const base = parseFlexibleNumber(
              normalizedFirstValueText,
              0,
              normalizedFirstValueText.length,
            );
            if (base !== null) {
              firstValue = base * multiplier;
            }
          }
        }
      } else if (firstHadMagnitude && !secondHadMagnitude) {
        const firstMagnitude = normalizedFirstValueText.match(
          artifacts.magnitudeSuffixRegex,
        );
        if (firstMagnitude) {
          const alias = normalizeMagnitudeAlias(firstMagnitude[2]);
          const multiplier = artifacts.magnitudeMultiplierByAlias.get(alias);
          if (multiplier !== undefined) {
            const base = parseFlexibleNumber(
              normalizedSecondValueText,
              0,
              normalizedSecondValueText.length,
            );
            if (base !== null) {
              secondValue = base * multiplier;
            }
          }
        }
      }

      matches.push({
        raw,
        start: candidate.index,
        end: candidate.index + raw.length,
        value: firstValue,
        rangeEndValue: secondValue,
        currency: parsedCurrency,
      });
    }

    const sortedMatches = matches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      const aLen = a.end - a.start;
      const bLen = b.end - b.start;
      return bLen - aLen;
    });

    const nonOverlappingMatches = [];
    let latestCoveredEnd = -1;

    for (const match of sortedMatches) {
      if (match.start < latestCoveredEnd) continue;
      nonOverlappingMatches.push(match);
      latestCoveredEnd = match.end;
    }

    return nonOverlappingMatches;
  }

  function mayContainCurrencyToken(input) {
    return Boolean(input?.length) &&
      quickDigitRegex.test(input) &&
      quickCurrencyTokenRegex.test(input);
  }

  function hasThousandMagnitudeHint(input) {
    return Boolean(input?.length) && thousandMagnitudeHintRegex.test(input);
  }

  return Object.freeze({
    parseValue,
    extractMatches,
    mayContainCurrencyToken,
    hasThousandMagnitudeHint,
  });
}

export function createCurrencyParser(config) {
  return createCompiledConfig(config);
}
