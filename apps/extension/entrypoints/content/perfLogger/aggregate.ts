import type {
  InlineConversionPerfAggregate,
  InlinePerfSample,
} from "../perfLogger.types";

export function createInlineConversionPerfAggregate(): InlineConversionPerfAggregate {
  return {
    totalMs: 0,
    clearExistingMs: 0,
    scanTextNodesMs: 0,
    decorateNodesMs: 0,
    scannedTextNodes: 0,
    conversionsApplied: 0,
    reachedNodeLimitPasses: 0,
  };
}

export function addInlinePerfSample(
  aggregate: InlineConversionPerfAggregate,
  sample: InlinePerfSample,
) {
  aggregate.totalMs += sample.totalMs;
  aggregate.clearExistingMs += sample.clearExistingMs;
  aggregate.scanTextNodesMs += sample.scanTextNodesMs;
  aggregate.decorateNodesMs += sample.decorateNodesMs;
  aggregate.scannedTextNodes += sample.scannedTextNodes;
  aggregate.conversionsApplied += sample.conversionsApplied;

  if (sample.reachedNodeLimit) {
    aggregate.reachedNodeLimitPasses += 1;
  }
}
