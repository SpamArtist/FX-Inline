import { createPerfLogger } from "../perfLogger";

type SettingsStoragePayload = {
  refreshed: boolean;
  missingRateSnapshot: boolean;
  preferredCurrencyChanged: boolean;
};

export type RuntimePerfContext = {
  perfLoggingEnabled: boolean;
  logPerf: ReturnType<typeof createPerfLogger>["log"];
  roundMs: ReturnType<typeof createPerfLogger>["roundMs"];
  logSettingsStorageUpdate: (
    startedAt: number,
    payload: SettingsStoragePayload,
  ) => void;
};

export function createRuntimePerfContext(namespace = "fx-inline"): RuntimePerfContext {
  const perfLogger = createPerfLogger(namespace);
  const perfLoggingEnabled = perfLogger.enabled;
  const logPerf = perfLogger.log;
  const roundMs = perfLogger.roundMs;

  function logSettingsStorageUpdate(
    startedAt: number,
    payload: SettingsStoragePayload,
  ) {
    if (!perfLoggingEnabled) return;

    logPerf("onSettingsStorageUpdate", {
      ...payload,
      durationMs: roundMs(performance.now() - startedAt),
    });
  }

  return {
    perfLoggingEnabled,
    logPerf,
    roundMs,
    logSettingsStorageUpdate,
  };
}
