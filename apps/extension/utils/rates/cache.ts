import { storage } from "wxt/utils/storage";
import type { RateSnapshot } from "../rates.types";

const RATE_CACHE_KEY = "local:rate-cache";

const rateCacheItem = storage.defineItem<RateSnapshot | null>(RATE_CACHE_KEY, {
  fallback: null,
});

export async function getCachedRateSnapshot(): Promise<RateSnapshot | null> {
  return rateCacheItem.getValue();
}

export async function setCachedRateSnapshot(snapshot: RateSnapshot): Promise<void> {
  await rateCacheItem.setValue(snapshot);
}
