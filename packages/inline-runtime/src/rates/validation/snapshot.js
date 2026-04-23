export function normalizeRates(rawRates) {
  const normalized = { USD: 1 };

  for (const [code, rate] of Object.entries(rawRates)) {
    const upperCode = code.toUpperCase();
    if (!/^[A-Z]{3,4}$/.test(upperCode)) continue;
    if (!Number.isFinite(rate) || rate <= 0) continue;
    normalized[upperCode] = rate;
  }

  return normalized;
}

export function isValidSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (!snapshot.rates || typeof snapshot.rates !== "object") return false;
  const usd = snapshot.rates.USD;
  return typeof usd === "number" && Number.isFinite(usd) && usd > 0;
}
