import { convertVisiblePrices } from "./convertVisiblePrices.js";

export function runPartialConversionPass(
  roots,
  pendingMutationRoots,
  preferredCurrency,
  rateSnapshot,
  options,
) {
  let conversions = 0;
  let connectedRoots = 0;
  let deferredRoots = 0;
  const passStartedAt = performance.now();

  for (let index = 0; index < roots.length; index += 1) {
    if (
      connectedRoots > 0 &&
      performance.now() - passStartedAt >= options.timeBudgetMs
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
      maxNodesPerPass: options.maxNodesPerPass,
      onPerfSample: options.onPerfSample,
    });
  }

  return {
    conversions,
    connectedRoots,
    deferredRoots,
  };
}
