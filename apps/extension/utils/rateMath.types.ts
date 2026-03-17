import type { CurrencyCode } from "./enums";

export type RateSnapshotLike = {
  rates: Partial<Record<CurrencyCode, number>>;
};
