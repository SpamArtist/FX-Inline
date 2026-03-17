import type {
  InlineConversionPerfAggregate,
  InlinePerfSample,
  PerfLogger,
} from "./perfLogger.types";

export type { InlineConversionPerfAggregate, PerfLogger } from "./perfLogger.types";

const PERF_DEBUG_STORAGE_KEY = "ccx:perf";

function isPerfLoggingEnabled(): boolean {
  if (import.meta.env.DEV) return true;

  try {
    return window.localStorage.getItem(PERF_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function createPerfLogger(namespace = "ccx"): PerfLogger {
  const enabled = isPerfLoggingEnabled();
  let sequence = 0;

  return {
    enabled,
    log: (event, payload) => {
      if (!enabled) return;

      sequence += 1;
      console.info(`[${namespace}][perf][${sequence}] ${event}`, payload);
    },
    roundMs: (value) => Math.round(value * 100) / 100,
  };
}

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
