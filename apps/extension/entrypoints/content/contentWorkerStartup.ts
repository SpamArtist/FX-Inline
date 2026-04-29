import type {
  ContentWorkerGlobal,
  ContentWorkerStartOptions,
} from "./content.types";

const STARTUP_OPTIONS_KEY = "__FX_INLINE_CONTENT_WORKER_START_OPTIONS__";

function getContentWorkerGlobal(): ContentWorkerGlobal {
  return globalThis as ContentWorkerGlobal;
}

export function setContentWorkerStartupOptions(
  options: ContentWorkerStartOptions = {},
): void {
  getContentWorkerGlobal()[STARTUP_OPTIONS_KEY] = options;
}

export function consumeContentWorkerStartupOptions(): ContentWorkerStartOptions {
  const workerGlobal = getContentWorkerGlobal();
  const options = workerGlobal[STARTUP_OPTIONS_KEY] ?? {};
  delete workerGlobal[STARTUP_OPTIONS_KEY];
  return options;
}
