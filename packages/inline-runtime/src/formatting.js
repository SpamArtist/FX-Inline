const currencyFormatterCache = new Map();
let activeFormatterPerfCapture = null;
let lastFormatterCacheKey = null;
let lastFormatterCacheValue;

function createFormatterPerfCapture() {
  return {
    cacheLookupMs: 0,
    cacheLookupCount: 0,
    formatterConstructionMs: 0,
    formatterConstructionCount: 0,
    formatCallMs: 0,
    formatCallCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    fallbackCount: 0,
  };
}

function getCurrencyFormatter(locale, currency, compact) {
  const perfCapture = activeFormatterPerfCapture;
  const lookupStartedAt = perfCapture ? performance.now() : 0;
  const localeKey = locale || "__default__";
  const cacheKey = `${localeKey}::${currency}::${compact ? "compact" : "standard"}`;
  if (cacheKey === lastFormatterCacheKey) {
    if (perfCapture) {
      perfCapture.cacheLookupMs += performance.now() - lookupStartedAt;
      perfCapture.cacheLookupCount += 1;
      perfCapture.cacheHits += 1;
    }
    return lastFormatterCacheValue;
  }
  const cached = currencyFormatterCache.get(cacheKey);
  if (perfCapture) {
    perfCapture.cacheLookupMs += performance.now() - lookupStartedAt;
    perfCapture.cacheLookupCount += 1;
  }
  if (cached !== undefined) {
    if (perfCapture) {
      perfCapture.cacheHits += 1;
    }
    lastFormatterCacheKey = cacheKey;
    lastFormatterCacheValue = cached;
    return cached;
  }
  if (perfCapture) {
    perfCapture.cacheMisses += 1;
  }

  const constructionStartedAt = perfCapture ? performance.now() : 0;
  try {
    const formatter = compact
      ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        notation: "compact",
        compactDisplay: "short",
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })
      : new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      });
    if (perfCapture) {
      perfCapture.formatterConstructionMs += performance.now() - constructionStartedAt;
      perfCapture.formatterConstructionCount += 1;
    }

    currencyFormatterCache.set(cacheKey, formatter);
    lastFormatterCacheKey = cacheKey;
    lastFormatterCacheValue = formatter;
    return formatter;
  } catch {
    if (perfCapture) {
      perfCapture.formatterConstructionMs += performance.now() - constructionStartedAt;
      perfCapture.formatterConstructionCount += 1;
    }
    currencyFormatterCache.set(cacheKey, null);
    lastFormatterCacheKey = cacheKey;
    lastFormatterCacheValue = null;
    return null;
  }
}

export function formatAmountInCurrency(amount, currency, options) {
  const locale = options?.localeHint?.trim() || undefined;
  const compactThreshold = options?.compactThreshold ?? 1_000_000;
  const useCompact =
    options?.compactLargeValues === true && Math.abs(amount) >= compactThreshold;

  const formatter = getCurrencyFormatter(locale, currency, useCompact);
  if (!formatter) {
    if (activeFormatterPerfCapture) {
      activeFormatterPerfCapture.fallbackCount += 1;
    }
    return `${amount.toFixed(2)} ${currency}`;
  }

  const perfCapture = activeFormatterPerfCapture;
  if (!perfCapture) {
    return formatter.format(amount);
  }

  const formatStartedAt = performance.now();
  const formatted = formatter.format(amount);
  perfCapture.formatCallMs += performance.now() - formatStartedAt;
  perfCapture.formatCallCount += 1;
  return formatted;
}

export function __clearCurrencyFormatterCacheForTests() {
  currencyFormatterCache.clear();
  lastFormatterCacheKey = null;
  lastFormatterCacheValue = undefined;
}

export function __startCurrencyFormatterPerfCaptureForTests() {
  activeFormatterPerfCapture = createFormatterPerfCapture();
  return activeFormatterPerfCapture;
}

export function __stopCurrencyFormatterPerfCaptureForTests() {
  const capture = activeFormatterPerfCapture ?? createFormatterPerfCapture();
  activeFormatterPerfCapture = null;
  return capture;
}
