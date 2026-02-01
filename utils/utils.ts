import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CurrencyCode, LocalStorageItem } from "./enums";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// TODO: Get active base currency from server
export function getPreferedBaseCurrency(): CurrencyCode {
  return (window.localStorage.getItem(
    LocalStorageItem.PREFERED_BASE_CURRENCY,
  ) || CurrencyCode["UNITED STATES DOLLAR"]) as CurrencyCode;
}

export function setPreferedBaseCurrency() {
  window.localStorage.setItem(
    LocalStorageItem.PREFERED_BASE_CURRENCY,
    CurrencyCode["UNITED STATES DOLLAR"],
  );
}

export function getPreferedAltCurrency(): CurrencyCode {
  return (window.localStorage.getItem(LocalStorageItem.PREFERED_ALT_CURRENCY) ||
    CurrencyCode.EURO) as CurrencyCode;
}

export function setPreferedAltCurrency() {
  window.localStorage.setItem(
    LocalStorageItem.PREFERED_BASE_CURRENCY,
    CurrencyCode.EURO,
  );
}

export function getConversionRatesAgainstPreferedBaseCurrency(
  currency: CurrencyCode,
) {
  const CONVERSION_RATES: Partial<Record<CurrencyCode, number>> = {
    [CurrencyCode["UNITED STATES DOLLAR"]]: 1,
    [CurrencyCode.EURO]: 0.83768698,
    [CurrencyCode.INDIA]: 92.1,
    [CurrencyCode.JAPAN]: 153.28,
  };

  return CONVERSION_RATES[currency];
}
