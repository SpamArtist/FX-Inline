import type {
  InlineConversionPerfAggregate,
  InlinePerfSample,
} from "../perfLogger.types";

export function createInlineConversionPerfAggregate(): InlineConversionPerfAggregate {
  return {
    setupMs: 0,
    discoveryMs: 0,
    analysisMs: 0,
    renderMs: 0,
    totalMs: 0,
    visitedTextNodes: 0,
    acceptedCandidates: 0,
    scannedTextNodes: 0,
    conversionsApplied: 0,
    reachedNodeLimitPasses: 0,
  };
}

export function addInlinePerfSample(
  aggregate: InlineConversionPerfAggregate,
  sample: InlinePerfSample,
) {
  aggregate.setupMs += sample.setupMs;
  aggregate.discoveryMs += sample.discoveryMs;
  aggregate.analysisMs += sample.analysisMs;
  aggregate.renderMs += sample.renderMs;
  aggregate.totalMs += sample.totalMs;
  aggregate.visitedTextNodes += sample.visitedTextNodes;
  aggregate.acceptedCandidates += sample.acceptedCandidates;
  aggregate.scannedTextNodes += sample.scannedTextNodes;
  aggregate.conversionsApplied += sample.conversionsApplied;

  if (sample.reachedNodeLimit) {
    aggregate.reachedNodeLimitPasses += 1;
  }
}
