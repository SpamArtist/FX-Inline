const currencyFormatterCache = new Map();

function getCurrencyFormatter(locale, currency, compact) {
  const localeKey = locale || "__default__";
  const cacheKey = `${localeKey}::${currency}::${compact ? "compact" : "standard"}`;
  const cached = currencyFormatterCache.get(cacheKey);
  if (cached !== undefined) {
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
    return formatter;
  } catch {
    currencyFormatterCache.set(cacheKey, null);
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
