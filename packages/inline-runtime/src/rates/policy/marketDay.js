export function getMarketDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function shouldUseMarketDayCache(marketDayKey, now = new Date()) {
  return marketDayKey === getMarketDayKey(now);
}
