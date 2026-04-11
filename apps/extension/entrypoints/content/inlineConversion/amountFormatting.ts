import { CurrencyCode } from "@/utils/enums";
import { convertAmountWithSnapshot } from "@/utils/rateMath";
import type { CurrencyTextMatch } from "@/utils/currencyUtils.types";
import type { RateSnapshot } from "@/utils/rates.types";
import { formatAmountInCurrency, hasThousandMagnitudeHint } from "@/utils/utils";
import { INLINE_COMPACT_THRESHOLD } from "./constants";

export function getConvertedAmountText(
  match: Pick<CurrencyTextMatch, "raw" | "value" | "rangeEndValue" | "currency">,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  localeHint: string | null,
): string | null {
  const isZeroValue =
    match.value === 0 &&
    (match.rangeEndValue === undefined || match.rangeEndValue === 0);
  if (isZeroValue) return null;
  if (match.currency === preferredCurrency) return null;

  const converted = convertAmountWithSnapshot(
    match.value,
    match.currency,
    preferredCurrency,
    rateSnapshot,
  );

  if (converted === null) return null;

  const compactThreshold = hasThousandMagnitudeHint(match.raw)
    ? 1_000
    : INLINE_COMPACT_THRESHOLD;
  const convertedUsesCompact = Math.abs(converted) >= compactThreshold;
  const formattedConverted = formatAmountInCurrency(converted, preferredCurrency, {
    localeHint,
    compactLargeValues: true,
    compactThreshold,
  });
  let convertedAmount = convertedUsesCompact
    ? `~${formattedConverted}`
    : formattedConverted;

  if (match.rangeEndValue !== undefined) {
    const convertedRangeEnd = convertAmountWithSnapshot(
      match.rangeEndValue,
      match.currency,
      preferredCurrency,
      rateSnapshot,
    );

    if (convertedRangeEnd === null) return null;

    const rangeEndUsesCompact = Math.abs(convertedRangeEnd) >= compactThreshold;
    const formattedRangeEnd = formatAmountInCurrency(
      convertedRangeEnd,
      preferredCurrency,
      {
        localeHint,
        compactLargeValues: true,
        compactThreshold,
      },
    );

    const rangeApproximationPrefix =
      convertedUsesCompact || rangeEndUsesCompact ? "~" : "";
    convertedAmount = `${rangeApproximationPrefix}${formattedConverted}–${formattedRangeEnd}`;
  }

  return convertedAmount;
}
