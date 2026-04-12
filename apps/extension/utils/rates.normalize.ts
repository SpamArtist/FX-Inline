import { isCurrencyCode } from "./currencyCodes";
import type { JsonObject, JsonValue } from "./json.types";
import { CurrencyCode } from "./enums";
import type {
  ExchangeApiResponse,
  ExchangeRateApiResponse,
  RateSnapshot,
} from "./rates.types";

function isObjectRecord(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseNumberRecord(
  value: JsonObject | undefined,
): Record<string, number> | null {
  if (!value) return null;

  const parsed: Record<string, number> = {};
  let hasValidEntry = false;

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) {
      continue;
    }

    parsed[key] = entryValue;
    hasValidEntry = true;
  }

  if (!hasValidEntry) {
    return null;
  }

  return parsed;
}

function isExchangeApiResponse(payload: JsonValue): payload is ExchangeApiResponse {
  return (
    isObjectRecord(payload) &&
    payload.result === "success" &&
    (payload.rates === undefined || isObjectRecord(payload.rates))
  );
}

function isExchangeRateApiResponse(
  payload: JsonValue,
): payload is ExchangeRateApiResponse {
  return isObjectRecord(payload) && (payload.rates === undefined || isObjectRecord(payload.rates));
}

export function parseRatesFromExchangeApi(payload: JsonValue): Record<string, number> {
  if (!isExchangeApiResponse(payload)) {
    throw new Error("Rate API returned an invalid payload");
  }

  const parsedRates = parseNumberRecord(payload.rates);
  if (!parsedRates) {
    throw new Error("Rate API returned an invalid payload");
  }

  return parsedRates;
}

export function parseRatesFromExchangeRateApi(
  payload: JsonValue,
): Record<string, number> {
  if (!isExchangeRateApiResponse(payload)) {
    throw new Error("ExchangeRate API returned an invalid payload");
  }

  const parsedRates = parseNumberRecord(payload.rates);
  if (!parsedRates) {
    throw new Error("ExchangeRate API returned an invalid payload");
  }

  return parsedRates;
}

export function isValidSnapshot(snapshot: RateSnapshot | null): snapshot is RateSnapshot {
  if (!snapshot) return false;
  if (snapshot.base !== CurrencyCode["UNITED STATES DOLLAR"]) return false;
  if (!snapshot.rates || typeof snapshot.rates !== "object") return false;

  const baseRate = snapshot.rates[CurrencyCode["UNITED STATES DOLLAR"]];
  return typeof baseRate === "number" && Number.isFinite(baseRate) && baseRate > 0;
}

export function normalizeRates(
  rawRates: Record<string, number>,
): Partial<Record<CurrencyCode, number>> {
  const normalized: Partial<Record<CurrencyCode, number>> = {
    [CurrencyCode["UNITED STATES DOLLAR"]]: 1,
  };

  for (const [code, rate] of Object.entries(rawRates)) {
    const upperCode = code.toUpperCase();

    if (!isCurrencyCode(upperCode)) continue;
    if (!Number.isFinite(rate) || rate <= 0) continue;

    normalized[upperCode] = rate;
  }

  return normalized;
}

