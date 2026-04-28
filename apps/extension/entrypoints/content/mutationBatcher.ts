import type {
  MutationRootBatcher,
  MutationRootBatcherDeps,
} from "./content.types";

const DEFAULT_MUTATION_ROOT_DEBOUNCE_MS = 160;

export function createMutationRootBatcher({
  collectRoots,
  enqueueRoots,
  shouldIgnoreMutations,
  debounceMs = DEFAULT_MUTATION_ROOT_DEBOUNCE_MS,
  setTimeout: scheduleTimeout = window.setTimeout.bind(window),
  clearTimeout: cancelTimeout = window.clearTimeout.bind(window),
}: MutationRootBatcherDeps): MutationRootBatcher {
  let pendingMutations: MutationRecord[] = [];
  let pendingTimer: ReturnType<Window["setTimeout"]> | null = null;

  function clearPendingTimer() {
    if (pendingTimer === null) return;
    cancelTimeout(pendingTimer);
    pendingTimer = null;
  }

  function flush() {
    clearPendingTimer();
    if (!pendingMutations.length) return;

    const mutations = pendingMutations;
    pendingMutations = [];

    if (shouldIgnoreMutations()) return;

    const roots = collectRoots(mutations);
    if (!roots.length) return;

    enqueueRoots(roots);
  }

  function push(mutations: MutationRecord[]) {
    if (shouldIgnoreMutations()) return;

    pendingMutations.push(...mutations);
    if (pendingTimer !== null) return;

    pendingTimer = scheduleTimeout(flush, debounceMs);
  }

  function cancel() {
    clearPendingTimer();
    pendingMutations = [];
  }

  return {
    push,
    flush,
    cancel,
  };
}
