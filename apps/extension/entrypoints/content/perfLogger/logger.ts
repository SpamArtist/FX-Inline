import type { PerfLogger } from "../perfLogger.types";
import { PERF_DEBUG_STORAGE_KEY } from "./constants";

function isPerfLoggingEnabled(): boolean {
  if (import.meta.env.DEV) return true;

  try {
    return window.localStorage.getItem(PERF_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function createPerfLogger(namespace = "fx-inline"): PerfLogger {
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
