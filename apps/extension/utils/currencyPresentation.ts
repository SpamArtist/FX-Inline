import currencies from "../assets/currency.json";
import { CurrencyCode } from "./enums";
import { formatAmountInCurrency } from "./utils";
import type { CurrencyListEntry } from "./currencyPresentation.types";

const CURRENCY_BY_CODE = new Map<CurrencyCode, CurrencyListEntry>(
  (currencies as CurrencyListEntry[]).map((entry) => [entry.code, entry]),
);

const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

function getDisplayNames(locale: string): Intl.DisplayNames | null {
  const cached = displayNamesCache.get(locale);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const formatter = new Intl.DisplayNames([locale], { type: "currency" });
    displayNamesCache.set(locale, formatter);
    return formatter;
  } catch {
    displayNamesCache.set(locale, null);
    return null;
  }
}

function resolveLocale(localeHint?: string | null): string {
  const trimmed = localeHint?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "en";
}

export function getCurrencyDisplayName(
  currency: CurrencyCode,
  localeHint?: string | null,
): string {
  const primaryLocale = resolveLocale(localeHint);
  const primaryDisplayNames = getDisplayNames(primaryLocale);
  const primaryName = primaryDisplayNames?.of(currency)?.trim();

  if (primaryName) {
    return primaryName;
  }

  if (primaryLocale !== "en") {
    const fallbackDisplayNames = getDisplayNames("en");
    const fallbackName = fallbackDisplayNames?.of(currency)?.trim();
    if (fallbackName) {
      return fallbackName;
    }
  }

  return CURRENCY_BY_CODE.get(currency)?.name?.trim() || currency;
}

export function getCurrencyIcon(currency: CurrencyCode): string {
  return CURRENCY_BY_CODE.get(currency)?.logo || "$";
}

const EDITABLE_AMOUNT_REGEX = /^[0-9]{0,}\.?[0-9]{0,4}$/;

export function isAmountDraftValid(value: string): boolean {
  return EDITABLE_AMOUNT_REGEX.test(value);
}

export function getNextAmountDraft(currentDraft: string, nextDraft: string): string {
  if (!isAmountDraftValid(nextDraft)) {
    return currentDraft;
  }

  return nextDraft;
}

export function commitAmountDraft(draft: string, currentAmount: string): string {
  const normalizedDraft = draft.trim();

  if (!normalizedDraft.length) {
    return currentAmount;
  }

  return isAmountDraftValid(normalizedDraft) ? normalizedDraft : currentAmount;
}

export function cancelAmountEdit(currentAmount: string): string {
  return currentAmount;
}

export function formatCurrencyHeadlineAmount(
  rawAmount: string,
  currency: CurrencyCode,
  localeHint?: string | null,
): string {
  const numericValue = Number(rawAmount);

  if (!Number.isFinite(numericValue)) {
    return rawAmount;
  }

  return formatAmountInCurrency(numericValue, currency, {
    localeHint: localeHint || null,
    compactLargeValues: false,
  });
}
