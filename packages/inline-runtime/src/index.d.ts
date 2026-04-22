export type CurrencyCodeLike = string;

export type RateSnapshotLike = {
  base?: string;
  fetchedAt?: number;
  marketDayKey?: string;
  source?: string;
  rates: Record<string, number>;
};

export type InlineConversionPerfSample = {
  totalMs: number;
  clearExistingMs: number;
  scanTextNodesMs: number;
  decorateNodesMs: number;
  scannedTextNodes: number;
  conversionsApplied: number;
  maxNodesPerPass: number;
  reachedNodeLimit: boolean;
};

export type ConvertVisiblePricesOptions = {
  clearExisting?: boolean;
  refreshExisting?: boolean;
  maxNodesPerPass?: number;
  onPerfSample?: (sample: InlineConversionPerfSample) => void;
  onNodeLimitReached?: (maxNodesPerPass: number) => void;
};

export type InlineRuntimeRefreshOptions = {
  forceRatesRefresh?: boolean;
  clearExisting?: boolean;
};

export type InlineRuntimeOptions = {
  root?: ParentNode;
  preferredCurrency?: CurrencyCodeLike | null;
  rateSnapshot?: RateSnapshotLike | null;
  enabled?: boolean;
  observeMutations?: boolean;
  autoFetchRates?: boolean;
  onPerfSample?: (sample: InlineConversionPerfSample) => void;
  onNodeLimitReached?: (maxNodesPerPass: number) => void;
  onError?: (error: unknown) => void;
  shouldExcludeMutationRoot?: (root: ParentNode) => boolean;
};

export type InlineRuntimeController = {
  start: () => void;
  stop: () => void;
  refresh: (options?: InlineRuntimeRefreshOptions) => void;
  setPreferredCurrency: (currency: CurrencyCodeLike | null) => void;
  setRateSnapshot: (snapshot: RateSnapshotLike | null) => void;
  setEnabled: (enabled: boolean) => void;
  destroy: () => void;
  enqueueMutationRoots: (roots: ParentNode[]) => void;
  shouldIgnoreMutations: () => boolean;
  setRoot: (root: ParentNode) => void;
  setObserveMutations: (observeMutations: boolean) => void;
};

export function createInlineRuntime(options?: InlineRuntimeOptions): InlineRuntimeController;

export function convertVisiblePrices(
  preferredCurrency: CurrencyCodeLike,
  rateSnapshot: RateSnapshotLike,
  root?: ParentNode,
  options?: ConvertVisiblePricesOptions,
): number;

export function suppressInlineConversions(root?: ParentNode): number;

export function clearInlineConversions(root?: ParentNode): number;

export function formatAmountInCurrency(
  amount: number,
  currency: CurrencyCodeLike,
  options?: {
    localeHint?: string | null;
    compactLargeValues?: boolean;
    compactThreshold?: number;
  },
): string;
