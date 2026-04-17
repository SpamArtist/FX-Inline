import { createCurrencyParser } from "@fx-inline/currency-detection";

const parser = createCurrencyParser();
const PARTIAL_TOKEN_REGEX =
  /[$€£¥₹₩₽₺₫₴₦₱]|(?:USD|EUR|GBP|JPY|INR|AUD|CAD|CNY|CHF|HKD|SGD|SEK|NOK|DKK|NZD|BRL|MXN|ZAR|AED|SAR|PKR|IDR|THB|MYR|VND)|(?:dollars?|euros?|pounds?|rupees?|yen|yuan|won|dirhams?|riyals?|francs?)/giu;
const SNIPPET_BOUNDARY_REGEX = /[\n\r,;.!?()[\]{}]/;
const UNSAFE_CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MAX_INPUT_LENGTH = 120000;

const sourceInput = document.getElementById("source");
const localeInput = document.getElementById("locale");
const matchesList = document.getElementById("matches");
const partialMatchesList = document.getElementById("partial-matches");
const fullCount = document.getElementById("full-count");
const partialCount = document.getElementById("partial-count");
const detectButton = document.getElementById("detect");
const resetButton = document.getElementById("reset");

if (
  !sourceInput ||
  !localeInput ||
  !matchesList ||
  !partialMatchesList ||
  !fullCount ||
  !partialCount ||
  !detectButton ||
  !resetButton
) {
  throw new Error("Playground DOM is missing required controls.");
}

function getLocaleHint() {
  const raw = localeInput.value.trim();
  return raw.length ? raw : document.documentElement.lang || "en";
}

function normalizeInput(rawInput) {
  return String(rawInput ?? "")
    .slice(0, MAX_INPUT_LENGTH)
    .replace(UNSAFE_CONTROL_CHARS_REGEX, " ");
}

function updateCount(container, value) {
  const countNode = container.querySelector("strong");
  if (!countNode) {
    return;
  }
  countNode.textContent = String(value);
}

function resetResults() {
  matchesList.textContent = "";
  partialMatchesList.textContent = "";
  updateCount(fullCount, 0);
  updateCount(partialCount, 0);
}

function hasRangeOverlap(rangeA, rangeB) {
  return rangeA.start < rangeB.end && rangeA.end > rangeB.start;
}

function expandSnippetRange(input, tokenStart, tokenEnd, maxExpand) {
  let start = tokenStart;
  let end = tokenEnd;

  for (let i = 0; i < maxExpand && start > 0; i += 1) {
    if (SNIPPET_BOUNDARY_REGEX.test(input[start - 1])) {
      break;
    }
    start -= 1;
  }

  for (let i = 0; i < maxExpand && end < input.length; i += 1) {
    if (SNIPPET_BOUNDARY_REGEX.test(input[end])) {
      break;
    }
    end += 1;
  }

  while (start < end && /\s/.test(input[start])) {
    start += 1;
  }

  while (end > start && /\s/.test(input[end - 1])) {
    end -= 1;
  }

  return { start, end };
}

function collectPartialMatches(input, fullMatches, localeHint) {
  PARTIAL_TOKEN_REGEX.lastIndex = 0;

  const partialMatches = [];
  const seenRanges = new Set();
  const fullRanges = fullMatches.map((match) => ({ start: match.start, end: match.end }));

  for (const candidate of input.matchAll(PARTIAL_TOKEN_REGEX)) {
    if (candidate.index === undefined) {
      continue;
    }

    const tokenRange = {
      start: candidate.index,
      end: candidate.index + candidate[0].length,
    };

    if (fullRanges.some((fullRange) => hasRangeOverlap(tokenRange, fullRange))) {
      continue;
    }

    const snippetRange = expandSnippetRange(
      input,
      tokenRange.start,
      tokenRange.end,
      28,
    );

    if (snippetRange.start >= snippetRange.end) {
      continue;
    }

    if (fullRanges.some((fullRange) => hasRangeOverlap(snippetRange, fullRange))) {
      continue;
    }

    const key = `${snippetRange.start}:${snippetRange.end}`;
    if (seenRanges.has(key)) {
      continue;
    }

    const raw = input.slice(snippetRange.start, snippetRange.end);
    const parsed = parser.parseValue(raw, { localeHint });
    if (parsed.valid) {
      continue;
    }

    partialMatches.push({
      raw,
      start: snippetRange.start,
      end: snippetRange.end,
    });
    seenRanges.add(key);
  }

  return partialMatches;
}

function runDetection() {
  resetResults();
  const localeHint = getLocaleHint();
  const text = normalizeInput(sourceInput.value);
  if (!parser.mayContainCurrencyToken(text)) return;

  const matches = parser.extractMatches(text, { localeHint });
  const partialMatches = collectPartialMatches(text, matches, localeHint);

  for (const match of matches) {
    const item = document.createElement("li");
    item.textContent = `${match.raw} -> ${match.currency} ${match.value}${match.rangeEndValue === undefined ? "" : ` to ${match.rangeEndValue}`}`;
    matchesList.append(item);
  }

  for (const match of partialMatches) {
    const item = document.createElement("li");
    item.textContent = `${match.raw} [${match.start}-${match.end}]`;
    partialMatchesList.append(item);
  }

  updateCount(fullCount, matches.length);
  updateCount(partialCount, partialMatches.length);
}

detectButton.addEventListener("click", runDetection);
resetButton.addEventListener("click", resetResults);

resetResults();
