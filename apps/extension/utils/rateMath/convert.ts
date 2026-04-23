import { CurrencyCode } from "../enums";
import type { RateSnapshotLike } from "../rateMath.types";

export function convertAmountWithSnapshot(
  amount: number,
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  snapshot: RateSnapshotLike,
): number | null {
  const sourceRate = snapshot.rates[sourceCurrency];
  const targetRate = snapshot.rates[targetCurrency];

  if (
    typeof sourceRate !== "number" ||
    !Number.isFinite(sourceRate) ||
    sourceRate <= 0
  ) {
    return null;
  }

  if (typeof targetRate !== "number" || !Number.isFinite(targetRate)) {
    return null;
  }

  return (amount * targetRate) / sourceRate;
}
