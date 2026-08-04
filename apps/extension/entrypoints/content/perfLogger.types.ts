import type { JsonObject } from "@/utils/json.types";
import type { InlineConversionPerfSample } from "./content.types";

export type PerfPayload = JsonObject;

export type InlinePerfSample = Pick<
  InlineConversionPerfSample,
  | "setupMs"
  | "discoveryMs"
  | "analysisMs"
  | "renderMs"
  | "totalMs"
  | "visitedTextNodes"
  | "acceptedCandidates"
  | "scannedTextNodes"
  | "conversionsApplied"
  | "reachedNodeLimit"
>;

export type InlineConversionPerfAggregate = {
  setupMs: number;
  discoveryMs: number;
  analysisMs: number;
  renderMs: number;
  totalMs: number;
  visitedTextNodes: number;
  acceptedCandidates: number;
  /** @deprecated Use acceptedCandidates. Kept as a compatibility alias. */
  scannedTextNodes: number;
  conversionsApplied: number;
  reachedNodeLimitPasses: number;
};

export type PerfLogger = {
  enabled: boolean;
  log: (event: string, payload: PerfPayload) => void;
  roundMs: (value: number) => number;
};
