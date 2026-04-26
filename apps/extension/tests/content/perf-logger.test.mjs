import { jest } from "@jest/globals";
import {
  addInlinePerfSample,
  createInlineConversionPerfAggregate,
  createPerfLogger,
} from "../../test-dist/entrypoints/content/perfLogger.js";

beforeEach(() => {
  window.localStorage.removeItem("fx-inline:perf");
  jest.restoreAllMocks();
});

afterEach(() => {
  window.localStorage.removeItem("fx-inline:perf");
  jest.restoreAllMocks();
});

test("createPerfLogger stays disabled unless debug key is enabled", () => {
  const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  const logger = createPerfLogger("fx-inline-test");

  expect(logger.enabled).toBe(false);
  logger.log("inlineConversion.full", { conversions: 1 });
  expect(infoSpy).not.toHaveBeenCalled();
  expect(logger.roundMs(12.345)).toBe(12.35);
});

test("createPerfLogger logs with incrementing sequence when enabled", () => {
  window.localStorage.setItem("fx-inline:perf", "1");
  const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  const logger = createPerfLogger("fx-inline-test");

  expect(logger.enabled).toBe(true);

  logger.log("inlineConversion.full", { conversions: 2 });
  logger.log("inlineConversion.partial", { conversions: 3 });

  expect(infoSpy).toHaveBeenCalledTimes(2);
  expect(infoSpy.mock.calls[0][0]).toContain("[fx-inline-test][perf][1] inlineConversion.full");
  expect(infoSpy.mock.calls[1][0]).toContain("[fx-inline-test][perf][2] inlineConversion.partial");
  expect(infoSpy.mock.calls[0][1]).toEqual({ conversions: 2 });
  expect(infoSpy.mock.calls[1][1]).toEqual({ conversions: 3 });
});

test("inline perf aggregate accumulates samples and node-limit passes", () => {
  const aggregate = createInlineConversionPerfAggregate();

  addInlinePerfSample(aggregate, {
    totalMs: 10,
    clearExistingMs: 1,
    scanTextNodesMs: 2,
    decorateNodesMs: 7,
    scannedTextNodes: 50,
    conversionsApplied: 4,
    reachedNodeLimit: false,
  });

  addInlinePerfSample(aggregate, {
    totalMs: 20,
    clearExistingMs: 3,
    scanTextNodesMs: 4,
    decorateNodesMs: 13,
    scannedTextNodes: 70,
    conversionsApplied: 6,
    reachedNodeLimit: true,
  });

  expect(aggregate).toEqual({
    totalMs: 30,
    clearExistingMs: 4,
    scanTextNodesMs: 6,
    decorateNodesMs: 20,
    scannedTextNodes: 120,
    conversionsApplied: 10,
    reachedNodeLimitPasses: 1,
  });
});
