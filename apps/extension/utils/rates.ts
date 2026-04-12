import { getCachedRateSnapshot, setCachedRateSnapshot } from "./rates.cache";
import { fetchLatestUsdSnapshotFromClient } from "./rates.fetch";
import { isValidSnapshot } from "./rates.normalize";
import { getMarketDayKey, shouldUseMarketDayCache } from "./ratePolicy";
import type { RateSnapshot } from "./rates.types";

export async function getRates(opts?: { forceRefresh?: boolean }): Promise<RateSnapshot> {
  const marketDayKey = getMarketDayKey();
  const cached = await getCachedRateSnapshot();

  if (
    !opts?.forceRefresh &&
    isValidSnapshot(cached) &&
    shouldUseMarketDayCache(cached.marketDayKey)
  ) {
    return cached;
  }

  try {
    const fetched = await fetchLatestUsdSnapshotFromClient();
    const snapshotWithMarketDay: RateSnapshot = {
      ...fetched,
      marketDayKey,
    };

    await setCachedRateSnapshot(snapshotWithMarketDay);
    return snapshotWithMarketDay;
  } catch (error) {
    if (isValidSnapshot(cached)) {
      return cached;
    }

    throw error;
  }
}

