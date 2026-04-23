function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function convertAmount(value, sourceCurrency, targetCurrency, rateSnapshot) {
  if (!isFiniteNumber(value)) return null;
  if (typeof sourceCurrency !== "string" || typeof targetCurrency !== "string") {
    return null;
  }

  const sourceRate = rateSnapshot?.rates?.[sourceCurrency];
  const targetRate = rateSnapshot?.rates?.[targetCurrency];

  if (!isFiniteNumber(sourceRate) || !isFiniteNumber(targetRate)) {
    return null;
  }

  const usdAmount = value / sourceRate;
  return usdAmount * targetRate;
}

export function formatCurrencyValue(value, currency, localeHint) {
  try {
    return new Intl.NumberFormat(localeHint || undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
