import type { JsonObject } from "@/utils/json.types";
import type { InlineConversionPerfSample } from "./content.types";

export type PerfPayload = JsonObject;

export type InlinePerfSample = Pick<
  InlineConversionPerfSample,
  | "totalMs"
  | "clearExistingMs"
  | "scanTextNodesMs"
  | "decorateNodesMs"
  | "scannedTextNodes"
  | "conversionsApplied"
  | "reachedNodeLimit"
>;

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
