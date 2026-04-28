import type { RateSnapshot } from "../rates.types";
import {
  readLocalStorageValue,
  writeLocalStorageValue,
} from "../localStorage";

const RATE_CACHE_KEY = "rate-cache";

export async function getCachedRateSnapshot(): Promise<RateSnapshot | null> {
  return readLocalStorageValue<RateSnapshot | null>(RATE_CACHE_KEY, null);
}

export async function setCachedRateSnapshot(snapshot: RateSnapshot): Promise<void> {
  await writeLocalStorageValue(RATE_CACHE_KEY, snapshot);
}
