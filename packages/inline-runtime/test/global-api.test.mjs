/** @jest-environment jsdom */

import { jest } from "@jest/globals";

const createInlineRuntimeMock = jest.fn();
const startMock = jest.fn();

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  startMock.mockReset();

  delete window.FXInlineRuntime;

  createInlineRuntimeMock.mockReturnValue({
    start: startMock,
    stop: jest.fn(),
    refresh: jest.fn(),
    setPreferredCurrency: jest.fn(),
    setRateSnapshot: jest.fn(),
    setEnabled: jest.fn(),
    destroy: jest.fn(),
    enqueueMutationRoots: jest.fn(),
    shouldIgnoreMutations: jest.fn(),
    setRoot: jest.fn(),
    setObserveMutations: jest.fn(),
  });
});

test("global bundle exports mount() and mounts runtime controller", async () => {
  await jest.unstable_mockModule("../src/runtime/controller.js", () => ({
    createInlineRuntime: createInlineRuntimeMock,
  }));

  await import("../src/global.js");

  expect(window.FXInlineRuntime).toBeDefined();
  expect(typeof window.FXInlineRuntime.mount).toBe("function");

  const runtime = window.FXInlineRuntime.mount({ preferredCurrency: "EUR" });

  expect(createInlineRuntimeMock).toHaveBeenCalledWith({ preferredCurrency: "EUR" });
  expect(startMock).toHaveBeenCalledTimes(1);
  expect(runtime).toBeDefined();
});
