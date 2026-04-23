import { getMarketDayKey, shouldUseMarketDayCache } from "../ratePolicy/index";
import type { RateSnapshot } from "../rates.types";
import { getCachedRateSnapshot, setCachedRateSnapshot } from "./cache";
import { fetchLatestUsdSnapshotFromClient } from "./providers";
import { isValidSnapshot } from "./validation";

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
