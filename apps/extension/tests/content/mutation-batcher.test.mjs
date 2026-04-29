import { jest } from "@jest/globals";
import { createMutationRootBatcher } from "../../test-dist/entrypoints/content/mutationBatcher.js";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("mutation root batcher coalesces observer bursts before collecting roots", () => {
  const root = document.createElement("div");
  const mutationA = { addedNodes: [document.createTextNode("$10")] };
  const mutationB = { addedNodes: [document.createElement("span")] };
  const collectRoots = jest.fn(() => [root]);
  const enqueueRoots = jest.fn();

  const batcher = createMutationRootBatcher({
    collectRoots,
    enqueueRoots,
    shouldIgnoreMutations: () => false,
    debounceMs: 160,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
  });

  batcher.push([mutationA]);
  batcher.push([mutationB]);

  jest.advanceTimersByTime(159);
  expect(collectRoots).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1);

  expect(collectRoots).toHaveBeenCalledTimes(1);
  expect(collectRoots).toHaveBeenCalledWith([mutationA, mutationB]);
  expect(enqueueRoots).toHaveBeenCalledWith([root]);
});

test("mutation root batcher skips work while runtime mutations are suppressed", () => {
  const collectRoots = jest.fn(() => [document.body]);
  const enqueueRoots = jest.fn();

  const batcher = createMutationRootBatcher({
    collectRoots,
    enqueueRoots,
    shouldIgnoreMutations: () => true,
    debounceMs: 160,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
  });

  batcher.push([{ addedNodes: [document.createTextNode("$10")] }]);
  jest.advanceTimersByTime(160);

  expect(collectRoots).not.toHaveBeenCalled();
  expect(enqueueRoots).not.toHaveBeenCalled();
});

test("mutation root batcher can flush and cancel pending mutations", () => {
  const root = document.createElement("div");
  const collectRoots = jest.fn(() => [root]);
  const enqueueRoots = jest.fn();

  const batcher = createMutationRootBatcher({
    collectRoots,
    enqueueRoots,
    shouldIgnoreMutations: () => false,
    debounceMs: 160,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
  });

  batcher.push([{ addedNodes: [document.createTextNode("$10")] }]);
  batcher.flush();

  expect(enqueueRoots).toHaveBeenCalledWith([root]);

  enqueueRoots.mockClear();
  batcher.push([{ addedNodes: [document.createTextNode("$20")] }]);
  batcher.cancel();
  jest.advanceTimersByTime(160);

  expect(enqueueRoots).not.toHaveBeenCalled();
});
