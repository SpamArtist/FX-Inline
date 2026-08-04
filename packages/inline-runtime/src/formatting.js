const currencyFormatterCache = new Map();
let lastFormatterCacheKey = null;
let lastFormatterCacheValue;

function getCurrencyFormatter(locale, currency, compact) {
  const localeKey = locale || "__default__";
  const cacheKey = `${localeKey}::${currency}::${compact ? "compact" : "standard"}`;
  if (cacheKey === lastFormatterCacheKey) {
    return lastFormatterCacheValue;
  }
  const cached = currencyFormatterCache.get(cacheKey);
  if (cached !== undefined) {
    lastFormatterCacheKey = cacheKey;
    lastFormatterCacheValue = cached;
    return cached;
  }

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
    currencyFormatterCache.set(cacheKey, formatter);
    lastFormatterCacheKey = cacheKey;
    lastFormatterCacheValue = formatter;
    return formatter;
  } catch {
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
    return `${amount.toFixed(2)} ${currency}`;
  }

  return formatter.format(amount);
}

export function __clearCurrencyFormatterCacheForTests() {
  currencyFormatterCache.clear();
  lastFormatterCacheKey = null;
  lastFormatterCacheValue = undefined;
}
