import { CurrencyCode } from "@/utils/enums";
import type { RateSnapshot } from "@/utils/rates.types";
import { extractCurrencyTextMatches, mayContainCurrencyToken } from "@/utils/utils";
import { getConvertedAmountText } from "./amountFormatting";
import {
  applyConvertedAmountColor,
  setInlineConversionContent,
} from "./conversionNodes";
import { INLINE_CONVERSION_CLASS } from "./constants";
import { usesLightTextColor } from "./textColor";

export function decoratePricesInTextNode(
  textNode: Text,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  localeHint: string | null,
  lightTextCache?: WeakMap<Element, boolean>,
): number {
  const text = textNode.nodeValue;
  if (!text?.trim()) return 0;
  if (!mayContainCurrencyToken(text)) return 0;

  const matches = extractCurrencyTextMatches(text, localeHint);
  if (!matches.length) return 0;
  const lightTextContext = usesLightTextColor(textNode, lightTextCache);

  let cursor = 0;
  let conversionsApplied = 0;
  const fragment = document.createDocumentFragment();

  for (const match of matches) {
    if (match.start < cursor) continue;

    fragment.append(text.slice(cursor, match.start));

    const convertedAmount = getConvertedAmountText(
      match,
      preferredCurrency,
      rateSnapshot,
      localeHint,
    );
    if (!convertedAmount) {
      fragment.append(match.raw);
      cursor = match.end;
      continue;
    }

    const wrapper = document.createElement("span");
    wrapper.className = INLINE_CONVERSION_CLASS;
    wrapper.setAttribute("data-original", match.raw);
    applyConvertedAmountColor(wrapper, lightTextContext);

    setInlineConversionContent(wrapper, convertedAmount, {
      originalText: match.raw,
    });

    fragment.append(wrapper);
    cursor = match.end;
    conversionsApplied += 1;
  }

  if (conversionsApplied === 0) return 0;

  fragment.append(text.slice(cursor));
  textNode.replaceWith(fragment);

  return conversionsApplied;
}
