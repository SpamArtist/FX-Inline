import { getMarketDayKey } from "./marketDay";

export function shouldUseTtlCache(
  fetchedAt: number,
  ttlMs: number,
  now = Date.now(),
): boolean {
  return now - fetchedAt <= ttlMs;
}

export function shouldUseMarketDayCache(
  marketDayKey: string | undefined,
  now = new Date(),
): boolean {
  return marketDayKey === getMarketDayKey(now);
}
