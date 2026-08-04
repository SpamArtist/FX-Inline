import { CurrencyCode } from "@/utils/enums";
import type { RateSnapshot } from "@/utils/rates.types";
import { convertVisiblePrices } from "../inlineConversion";
import { PARTIAL_CONVERSION_MAX_NODES_PER_PASS } from "./constants";

export type PartialConversionPassResult = {
  conversions: number;
  connectedRoots: number;
  deferredRoots: number;
};

export function runPartialConversionPass(
  roots: ParentNode[],
  pendingMutationRoots: Set<ParentNode>,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  timeBudgetMs: number,
): PartialConversionPassResult {
  let conversions = 0;
  let connectedRoots = 0;
  let deferredRoots = 0;
  const passStartedAt = performance.now();

  for (let index = 0; index < roots.length; index += 1) {
    if (
      connectedRoots > 0 &&
      performance.now() - passStartedAt >= timeBudgetMs
    ) {
      for (let remainderIndex = index; remainderIndex < roots.length; remainderIndex += 1) {
        pendingMutationRoots.add(roots[remainderIndex]);
        deferredRoots += 1;
      }

      break;
    }

    const root = roots[index];
    if (!(root instanceof Node) || !root.isConnected) continue;
    connectedRoots += 1;

    conversions += convertVisiblePrices(preferredCurrency, rateSnapshot, root, {
      clearExisting: false,
      maxNodesPerPass: PARTIAL_CONVERSION_MAX_NODES_PER_PASS,
    });
  }

  return {
    conversions,
    connectedRoots,
    deferredRoots,
  };
}
