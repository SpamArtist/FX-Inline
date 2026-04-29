import type { RateSnapshot } from "@/utils/rates.types";
import type { InlineConversionPerfSample } from "./content.types";
import {
  INLINE_CONVERSION_CLASS,
  convertVisiblePrices as convertVisiblePricesShared,
} from "@fx-inline/inline-runtime/extension";

export { INLINE_CONVERSION_CLASS };

export function convertVisiblePrices(
  preferredCurrency: string,
  rateSnapshot: RateSnapshot,
  root: ParentNode = document.body,
  options?: {
    clearExisting?: boolean;
    refreshExisting?: boolean;
    maxNodesPerPass?: number;
    onPerfSample?: (sample: InlineConversionPerfSample) => void;
  },
): number {
  return convertVisiblePricesShared(preferredCurrency, rateSnapshot, root, options);
}
