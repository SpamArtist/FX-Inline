import {
  getMemoryRateCache,
  setMemoryRateCache,
} from "./cache/memory.js";
import { getMarketDayKey, shouldUseMarketDayCache } from "./policy/marketDay.js";
import { fetchLatestUsdSnapshotFromClient } from "./providers/client.js";
import { isValidSnapshot } from "./validation/snapshot.js";

export async function getRates(options) {
  const marketDayKey = getMarketDayKey();
  const cachedSnapshot = getMemoryRateCache();

  if (
    !options?.forceRefresh &&
    isValidSnapshot(cachedSnapshot) &&
    shouldUseMarketDayCache(cachedSnapshot.marketDayKey)
  ) {
    return cachedSnapshot;
  }

  try {
    const fetched = await fetchLatestUsdSnapshotFromClient();
    const nextSnapshot = {
      ...fetched,
      marketDayKey,
    };
    setMemoryRateCache(nextSnapshot);

    return nextSnapshot;
  } catch (error) {
    const fallbackSnapshot = getMemoryRateCache();
    if (isValidSnapshot(fallbackSnapshot)) {
      return fallbackSnapshot;
    }

    throw error;
  }
}

export function __setMemoryRateCacheForTests(snapshot) {
  setMemoryRateCache(snapshot);
}
