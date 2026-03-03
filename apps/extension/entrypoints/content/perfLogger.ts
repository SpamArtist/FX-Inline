const PERF_DEBUG_STORAGE_KEY = "ccx:perf";

type PerfPayload = Record<string, unknown>;
type InlinePerfSample = {
  totalMs: number;
  clearExistingMs: number;
  scanTextNodesMs: number;
  decorateNodesMs: number;
  scannedTextNodes: number;
  conversionsApplied: number;
  reachedNodeLimit: boolean;
};

export type InlineConversionPerfAggregate = {
  totalMs: number;
  clearExistingMs: number;
  scanTextNodesMs: number;
  decorateNodesMs: number;
  scannedTextNodes: number;
  conversionsApplied: number;
  reachedNodeLimitPasses: number;
};

export type PerfLogger = {
  enabled: boolean;
  log: (event: string, payload: PerfPayload) => void;
  roundMs: (value: number) => number;
};

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
