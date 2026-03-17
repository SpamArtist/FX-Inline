import type { CurrencyCode } from "./enums";
import type { JsonObject, JsonValue } from "./json.types";
import type { RateSnapshotLike } from "./rateMath.types";

export type ExchangeApiResponse = {
  result?: string;
  rates?: JsonObject;
};

export type ExchangeRateApiResponse = {
  rates?: JsonObject;
};

export type RateProvider = {
  name: string;
  url: string;
  parse: (payload: JsonValue) => Record<string, number>;
};

export type RateSnapshot = RateSnapshotLike & {
  base: CurrencyCode;
  fetchedAt: number;
  marketDayKey?: string;
  source?: string;
};
